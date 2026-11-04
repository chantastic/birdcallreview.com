#!/usr/bin/env python3
"""Check dist/feed.xml against the Jekyll fixture.

GUIDs, enclosure URLs, and lastBuildDate must match the feed this build
replaces. Item links are the https episode URL. Enclosure URLs are the R2
host plus the historical filename. Those edits, plus https channel URLs,
audio/mpeg, and dropped empty subtitles, are reversed before a byte compare.
"""

import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OLD = ROOT / "scripts/fixtures/jekyll-feed.xml"
NEW = ROOT / "dist/feed.xml"
DIST = ROOT / "dist"
AUDIO_ORIGIN = "https://episodes.birdcallreview.com"
SITE_ORIGIN = "https://birdcallreview.com"
LEGACY_ORIGIN = "http://birdcallreview.com"
NS = {
    "itunes": "http://www.itunes.com/dtds/podcast-1.0.dtd",
    "atom": "http://www.w3.org/2005/Atom",
    "content": "http://purl.org/rss/1.0/modules/content/",
    "sm": "http://www.sitemaps.org/schemas/sitemap/0.9",
}

ENCLOSURE = re.compile(
    r'<enclosure url="([^"]+)" length="([^"]+)" type="([^"]+)" />'
)
TRANSCRIPT_TURN = re.compile(r"^\*\*\[\d{2}:\d{2}:\d{2}\] [^:]+:\*\*\s+(.+)$")
ITEM_SUBTITLE = re.compile(r"<itunes:subtitle></itunes:subtitle>")


def leaked_transcript(page: str, slug: str) -> str | None:
    path = ROOT / "transcripts" / f"{slug}.md"
    if not path.exists():
        return None
    for line in path.read_text().splitlines():
        match = TRANSCRIPT_TURN.match(line)
        if not match:
            continue
        text = match.group(1).strip()
        if len(text) >= 24 and text in page:
            return text
    return None


def fail(message: str) -> int:
    print(message, file=sys.stderr)
    return 1


def filenames(text: str) -> list[tuple[str, str, str, str]]:
    rows = []
    for url, length, mime in ENCLOSURE.findall(text):
        rows.append((url, url.rsplit("/", 1)[-1], length, mime))
    return rows


def main() -> int:
    if not NEW.exists():
        return fail(f"missing {NEW}")
    old = OLD.read_text()
    new = NEW.read_text()
    old_rows = filenames(old)
    new_rows = filenames(new)
    if len(old_rows) != 25 or len(new_rows) != 25:
        return fail(f"expected 25 enclosures, old={len(old_rows)} new={len(new_rows)}")

    old_root = ET.fromstring(old)
    new_root = ET.fromstring(new)
    old_channel = old_root.find("channel")
    new_channel = new_root.find("channel")
    old_built = (old_channel.find("lastBuildDate").text or "").strip()
    new_built = (new_channel.find("lastBuildDate").text or "").strip()
    if new_built != old_built:
        return fail(f"lastBuildDate changed\n old={old_built}\n new={new_built}")

    old_items = old_channel.findall("item")
    new_items = new_channel.findall("item")
    if len(old_items) != 25 or len(new_items) != 25:
        return fail(f"item count old={len(old_items)} new={len(new_items)}")

    guids = []
    for index, (old_item, new_item, old_row, new_row) in enumerate(
        zip(old_items, new_items, old_rows, new_rows)
    ):
        old_guid = (old_item.find("guid").text or "").strip()
        new_guid = (new_item.find("guid").text or "").strip()
        old_link = (old_item.find("link").text or "").strip()
        new_link = (new_item.find("link").text or "").strip()
        old_url, old_name, old_len, old_type = old_row
        new_url, new_name, new_len, new_type = new_row
        expected_url = f"{AUDIO_ORIGIN}/{old_name}"
        slug = new_guid.rsplit("/", 1)[-1]
        expected_link = f"{SITE_ORIGIN}/{slug}"
        if new_guid != old_guid:
            return fail(f"guid changed [{index}]\n old={old_guid}\n new={new_guid}")
        if new_link != expected_link:
            return fail(f"item link [{index}] {new_link} expected {expected_link}")
        if new_link == new_guid or new_link == old_link:
            return fail(f"item link still matches the http guid {new_link}")
        if not new_guid.startswith(f"{LEGACY_ORIGIN}/"):
            return fail(f"guid left the legacy http permalink {new_guid}")
        if new_name != old_name or new_len != old_len:
            return fail(f"enclosure metadata changed {old_name} {new_name} {old_len} {new_len}")
        if old_type != "audio/x-mp3" or new_type != "audio/mpeg":
            return fail(f"enclosure type {old_name}: old={old_type} new={new_type}")
        if new_url != expected_url:
            return fail(f"enclosure URL changed {new_url} expected {expected_url}")
        if new_item.find(f"{{{NS['itunes']}}}subtitle") is not None:
            return fail(f"empty itunes:subtitle still present on {new_guid}")
        image = new_item.find(f"{{{NS['itunes']}}}image")
        if image is None or image.attrib.get("href") != f"{SITE_ORIGIN}/img/logo.png":
            return fail(f"item artwork is not https apex {new_guid}")
        guids.append(new_guid)
        print(f"stable\t{new_guid}\t{new_link}\t{new_url}")

    atom = new_channel.find(f"{{{NS['atom']}}}link")
    if atom is None or atom.attrib.get("href") != f"{SITE_ORIGIN}/feed.xml":
        return fail(f"atom:link self is not {SITE_ORIGIN}/feed.xml")
    if atom.attrib.get("rel") != "self" or atom.attrib.get("type") != "application/rss+xml":
        return fail("atom:link lost rel=self or type")
    if (new_channel.find("link").text or "").strip() != f"{SITE_ORIGIN}/":
        return fail("channel link is not the https apex")
    channel_image = new_channel.find(f"{{{NS['itunes']}}}image")
    if channel_image is None or channel_image.attrib.get("href") != f"{SITE_ORIGIN}/img/logo.png":
        return fail("channel artwork is not https apex")
    if new_channel.find(f"{{{NS['itunes']}}}complete") is not None or "<itunes:complete" in new:
        return fail("itunes:complete was added; leave it out until the show is declared finished")
    if ITEM_SUBTITLE.search(new):
        return fail("empty itunes:subtitle remains in the feed text")

    rewritten = new.replace(f"{SITE_ORIGIN}/", f"{LEGACY_ORIGIN}/")
    rewritten = rewritten.replace('type="audio/mpeg"', 'type="audio/x-mp3"')
    for (old_url, old_name, _length, _mime), (new_url, _name, _new_len, _new_type) in zip(old_rows, new_rows):
        rewritten = rewritten.replace(f"{AUDIO_ORIGIN}/{old_name}", old_url, 1)
        if old_url == new_url:
            return fail(f"enclosure was not on the R2 host {old_url}")
    rewritten = rewritten.replace(
        "<itunes:author>Jeremy Ricketts &amp; Michael Chan</itunes:author>\n        <itunes:summary>",
        "<itunes:author>Jeremy Ricketts &amp; Michael Chan</itunes:author>\n        <itunes:subtitle></itunes:subtitle>\n        <itunes:summary>",
    )
    if rewritten != old:
        import difflib

        diff = "".join(
            difflib.unified_diff(
                old.splitlines(True),
                rewritten.splitlines(True),
                fromfile="jekyll",
                tofile="normalized-new",
                n=2,
            )
        )
        print(diff[:8000], file=sys.stderr)
        return fail("feed differs beyond the allowed https, type, and empty-subtitle edits")

    if new_root.tag != "rss" or new_root.attrib.get("version") != "2.0":
        return fail("not an RSS 2.0 document")
    if new_channel.find(f"{{{NS['itunes']}}}author") is None or atom is None:
        return fail("itunes or atom namespace is not in use")
    if (
        f'xmlns:itunes="{NS["itunes"]}"' not in new
        or f'xmlns:atom="{NS["atom"]}"' not in new
        or f'xmlns:content="{NS["content"]}"' not in new
    ):
        return fail("missing xmlns declaration")
    required = ["title", "link", "description", "language", "copyright", "pubDate", "lastBuildDate"]
    for tag in required:
        node = new_channel.find(tag)
        if node is None or not (node.text or "").strip():
            return fail(f"missing channel {tag}")
    itunes_required = ["subtitle", "author", "summary", "explicit", "image", "owner", "category"]
    for tag in itunes_required:
        if new_channel.find(f"{{{NS['itunes']}}}{tag}") is None:
            return fail(f"missing itunes channel {tag}")

    for item in new_items:
        for tag in ("title", "description", "pubDate", "link"):
            node = item.find(tag)
            if node is None or not (node.text or "").strip():
                return fail(f"missing item {tag}")
        guid = item.find("guid")
        if guid is None or guid.attrib.get("isPermaLink") != "true" or not guid.text:
            return fail("bad guid")
        enclosure = item.find("enclosure")
        if enclosure is None or enclosure.attrib.get("type") != "audio/mpeg":
            return fail("bad enclosure")
        if not enclosure.attrib.get("length", "").isdigit():
            return fail("bad length")
        slug = guid.text.rsplit("/", 1)[-1]
        episode_html = DIST / f"{slug}.html"
        if not episode_html.exists():
            return fail(f"missing episode html {slug}")
        page = episode_html.read_text()
        if f'src="https://episodes.birdcallreview.com/' not in page or "<audio-player" not in page:
            return fail(f"{slug} is missing the audio player or R2 source")
        if 'controls' not in page or "episode-audio" not in page:
            return fail(f"{slug} dropped the native audio controls")
        if 'class="transcript"' in page or "transcript-turn" in page or "transcript-text" in page:
            return fail(f"{slug} still publishes a transcript")
        leaked = leaked_transcript(page, slug)
        if leaked:
            return fail(f"{slug} publishes transcript text")
        if 'class="copy-now"' not in page or 'class="play-from"' not in page:
            return fail(f"{slug} is missing the timestamp controls")
        if "jsdelivr" in page or "cdn.jsdelivr.net" in page:
            return fail(f"{slug} loads the player from a CDN")
        for tag in ("author", "summary", "image", "duration"):
            if item.find(f"{{{NS['itunes']}}}{tag}") is None:
                return fail(f"missing itunes item {tag} {guid.text}")

    for rel in [
        "index.html",
        "feed.xml",
        "sitemap.xml",
        "robots.txt",
        "credits.html",
        "css/main.css",
        "img/birds.png",
        "img/logo.png",
        "about/index.html",
        "_headers",
    ]:
        if not (DIST / rel).exists():
            return fail(f"missing asset {rel}")
    for page in (2, 3, 4, 5):
        nested = DIST / str(page) / "index.html"
        flat = DIST / f"{page}.html"
        if not nested.exists() and not flat.exists():
            return fail(f"missing pagination {page}")

    home = (DIST / "index.html").read_text()
    if 'rel="canonical" href="https://birdcallreview.com/"' not in home:
        return fail("home canonical is not the https apex")
    if 'type="application/rss+xml"' not in home or 'href="https://birdcallreview.com/feed.xml"' not in home:
        return fail("RSS alternate is not the https feed")
    if "UA-74078597" in home or "google-analytics.com" in home or "GoogleAnalyticsObject" in home:
        return fail("universal analytics tag is still in the home page")
    if "2016\u20132019" not in home:
        return fail("footer year range was not derived from episode dates")

    about = (DIST / "about/index.html").read_text()
    if "jekyll" in about.lower() or "jekyll-new" in about:
        return fail("about still contains the Jekyll starter")
    if "Bird calls are incredibly diverse." not in about:
        return fail("about is missing the site tagline")
    if "25 episodes, from Jan 15, 2016 through May 24, 2019." not in about:
        return fail("about episode span does not match the collection")
    if re.search(r"^\s*/\s*$", about, re.M):
        return fail("about still has the stray slash")

    credits = (DIST / "credits.html").read_text()
    if "Astro" not in credits or "Cloudflare Workers" not in credits or "R2" not in credits:
        return fail("credits do not name Astro, Workers, and R2")
    if "jekyllrb.com" in credits or "pages.github.com" in credits:
        return fail("credits still name Jekyll or GitHub Pages")

    robots = (DIST / "robots.txt").read_text()
    if "User-agent: *" not in robots or "Sitemap: https://birdcallreview.com/sitemap.xml" not in robots:
        return fail(f"robots.txt missing User-agent or Sitemap\n{robots}")
    if robots.lstrip().startswith("#"):
        return fail("robots.txt is the Cloudflare content-signals boilerplate")

    sitemap = ET.fromstring((DIST / "sitemap.xml").read_text())
    locs = [node.text or "" for node in sitemap.findall(f"{{{NS['sm']}}}url/{{{NS['sm']}}}loc")]
    expected = {
        f"{SITE_ORIGIN}/",
        f"{SITE_ORIGIN}/2/",
        f"{SITE_ORIGIN}/3/",
        f"{SITE_ORIGIN}/4/",
        f"{SITE_ORIGIN}/5/",
        f"{SITE_ORIGIN}/about/",
        f"{SITE_ORIGIN}/credits",
        *(f"{SITE_ORIGIN}/{guid.rsplit('/', 1)[-1]}" for guid in guids),
    }
    if set(locs) != expected or len(locs) != len(expected):
        missing = sorted(expected - set(locs))
        extra = sorted(set(locs) - expected)
        return fail(f"sitemap mismatch missing={missing} extra={extra}")
    if any(not loc.startswith(f"{SITE_ORIGIN}/") for loc in locs):
        return fail("sitemap contains a non-https URL")

    headers = (DIST / "_headers").read_text()
    if "Content-Type: application/rss+xml; charset=utf-8" not in headers:
        return fail("_headers does not set the feed content type")

    print(f"lastBuildDate {new_built}")
    print(f"guids {len(guids)} unchanged")
    print(f"enclosures {len(new_rows)} on {AUDIO_ORIGIN}")
    print("FEED_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
