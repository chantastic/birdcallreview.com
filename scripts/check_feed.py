#!/usr/bin/env python3
"""Compare dist/feed.xml with the Jekyll feed. Enclosure URLs are the only allowed difference."""

import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OLD = ROOT / "scripts/fixtures/jekyll-feed.xml"
NEW = ROOT / "dist/feed.xml"
DIST = ROOT / "dist"
AUDIO_ORIGIN = "https://episodes.birdcallreview.com"
NS = {
    "itunes": "http://www.itunes.com/dtds/podcast-1.0.dtd",
    "atom": "http://www.w3.org/2005/Atom",
    "content": "http://purl.org/rss/1.0/modules/content/",
}

ENCLOSURE = re.compile(
    r'<enclosure url="([^"]+)" length="([^"]+)" type="([^"]+)" />'
)


def filenames(text: str) -> list[tuple[str, str, str, str]]:
    rows = []
    for url, length, mime in ENCLOSURE.findall(text):
        rows.append((url, url.rsplit("/", 1)[-1], length, mime))
    return rows


def main() -> int:
    if not NEW.exists():
        print("missing", NEW, file=sys.stderr)
        return 1
    old = OLD.read_text()
    new = NEW.read_text()
    old_rows = filenames(old)
    new_rows = filenames(new)
    if len(old_rows) != 25 or len(new_rows) != 25:
        print(f"expected 25 enclosures, old={len(old_rows)} new={len(new_rows)}", file=sys.stderr)
        return 1

    rewritten = new
    for (old_url, old_name, old_len, old_type), (new_url, new_name, new_len, new_type) in zip(old_rows, new_rows):
        if old_name != new_name or old_len != new_len or old_type != new_type:
            print("enclosure metadata changed", old_name, new_name, old_len, new_len, old_type, new_type, file=sys.stderr)
            return 1
        expected = f"{AUDIO_ORIGIN}/{old_name}"
        if new_url != expected:
            print("unexpected enclosure", new_url, "expected", expected, file=sys.stderr)
            return 1
        if old_url == new_url:
            print("enclosure was not updated", old_url, file=sys.stderr)
            return 1
        rewritten = rewritten.replace(new_url, old_url, 1)

    if rewritten != old:
        import difflib
        diff = "".join(difflib.unified_diff(old.splitlines(True), rewritten.splitlines(True), fromfile="jekyll", tofile="rewritten-new", n=2))
        print(diff[:8000], file=sys.stderr)
        print("feed differs beyond enclosure URLs", file=sys.stderr)
        return 1

    root = ET.fromstring(new)
    if root.tag != "rss" or root.attrib.get("version") != "2.0":
        print("not an RSS 2.0 document", file=sys.stderr)
        return 1
    # ElementTree drops xmlns declarations from attrib and expands prefixed tags.
    channel = root.find("channel")
    if channel.find(f"{{{NS['itunes']}}}author") is None or channel.find(f"{{{NS['atom']}}}link") is None:
        print("itunes or atom namespace is not in use", file=sys.stderr)
        return 1
    if f'xmlns:itunes="{NS["itunes"]}"' not in new or f'xmlns:atom="{NS["atom"]}"' not in new or f'xmlns:content="{NS["content"]}"' not in new:
        print("missing xmlns declaration", file=sys.stderr)
        return 1
    required = ["title", "link", "description", "language", "copyright", "pubDate", "lastBuildDate"]
    for tag in required:
        if channel.find(tag) is None or not (channel.find(tag).text or "").strip():
            print("missing channel", tag, file=sys.stderr)
            return 1
    itunes_required = ["subtitle", "author", "summary", "explicit", "image", "owner", "category"]
    for tag in itunes_required:
        if channel.find(f"{{{NS['itunes']}}}{tag}") is None:
            print("missing itunes channel", tag, file=sys.stderr)
            return 1
    if channel.find(f"{{{NS['atom']}}}link") is None:
        print("missing atom:link", file=sys.stderr)
        return 1

    items = channel.findall("item")
    if len(items) != 25:
        print("item count", len(items), file=sys.stderr)
        return 1
    guids = []
    for item in items:
        for tag in ("title", "description", "pubDate", "link"):
            node = item.find(tag)
            if node is None or not (node.text or "").strip():
                print("missing item", tag, file=sys.stderr)
                return 1
        guid = item.find("guid")
        if guid is None or guid.attrib.get("isPermaLink") != "true" or not guid.text:
            print("bad guid", file=sys.stderr)
            return 1
        if not guid.text.startswith("http://birdcallreview.com/"):
            print("guid is not the legacy http permalink", guid.text, file=sys.stderr)
            return 1
        if guid.text != item.find("link").text:
            print("guid/link mismatch", guid.text, file=sys.stderr)
            return 1
        enclosure = item.find("enclosure")
        if enclosure is None or enclosure.attrib.get("type") != "audio/x-mp3":
            print("bad enclosure", file=sys.stderr)
            return 1
        if not enclosure.attrib.get("length", "").isdigit():
            print("bad length", file=sys.stderr)
            return 1
        if not enclosure.attrib["url"].startswith(f"{AUDIO_ORIGIN}/"):
            print("enclosure host", enclosure.attrib["url"], file=sys.stderr)
            return 1
        for tag in ("author", "subtitle", "summary", "image", "duration"):
            if item.find(f"{{{NS['itunes']}}}{tag}") is None:
                print("missing itunes item", tag, guid.text, file=sys.stderr)
                return 1
        guids.append(guid.text)
        slug = guid.text.rsplit("/", 1)[-1]
        html_path = DIST / f"{slug}.html"
        if not html_path.exists():
            print("missing episode html", html_path, file=sys.stderr)
            return 1

    for rel in ["index.html", "feed.xml", "credits.html", "css/main.css", "img/birds.png", "img/logo.png", "about/index.html"]:
        if not (DIST / rel).exists():
            alt = DIST / rel.replace("/index.html", ".html") if rel.endswith("/index.html") else None
            print("missing asset", rel, "alt", alt.exists() if alt else None, file=sys.stderr)
            return 1
    for page in (2, 3, 4, 5):
        nested = DIST / str(page) / "index.html"
        flat = DIST / f"{page}.html"
        if not nested.exists() and not flat.exists():
            print("missing pagination", page, file=sys.stderr)
            return 1
        print(f"pagination /{page}/ -> {'directory index' if nested.exists() else 'flat html'}")

    old_hosts = {}
    for url, name, length, mime in old_rows:
        old_hosts.setdefault(url.split("/")[2], 0)
        old_hosts[url.split("/")[2]] += 1
        print(f"{name}\t{length}\t{mime}\t{url}\t->\t{AUDIO_ORIGIN}/{name}")
    print("old hosts", old_hosts)
    print("guids", len(guids))
    print("FEED_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
