import {
  ARTWORK_URL,
  AUDIO_ORIGIN,
  LEGACY_PERMALINK_ORIGIN,
  SITE_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
  episodeHtml,
  type Episode,
} from './episodes';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function xmlEscape(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** 12:00 Pacific Standard (-0800), shown in America/Los_Angeles with DST. */
export function rfc822Pacific(isoDate: string): string {
  const instant = new Date(`${isoDate}T12:00:00-08:00`);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'shortOffset',
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  const offset = parts.timeZoneName.replace('GMT', '').replace('UTC', '');
  const match = offset.match(/^([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) throw new Error(`Unexpected timezone offset ${parts.timeZoneName} for ${isoDate}`);
  const zone = `${match[1]}${match[2].padStart(2, '0')}${match[3] ?? '00'}`;
  const weekday = WEEKDAYS.includes(parts.weekday as (typeof WEEKDAYS)[number]) ? parts.weekday : parts.weekday;
  const month = MONTHS.includes(parts.month as (typeof MONTHS)[number]) ? parts.month : parts.month;
  return `${weekday}, ${parts.day} ${month} ${parts.year} ${parts.hour}:${parts.minute}:${parts.second} ${zone}`;
}

function itemXml(episode: Episode): string {
  const html = episodeHtml(episode.body);
  const guid = `${LEGACY_PERMALINK_ORIGIN}/${episode.id}`;
  const enclosure = `${AUDIO_ORIGIN}/${episode.data.audio}`;
  return `      <item>
        <title>${xmlEscape(episode.data.title)}</title>
        <itunes:author>Jeremy Ricketts &amp; Michael Chan</itunes:author>
        <itunes:summary><![CDATA[${html}]]></itunes:summary>
        <itunes:image href="${ARTWORK_URL}" />
        <itunes:duration>${episode.data.duration}</itunes:duration>
        <enclosure url="${enclosure}" length="${episode.data.bytes}" type="audio/mpeg" />
        <description>${xmlEscape(html)}</description>
        <pubDate>${rfc822Pacific(episode.data.date)}</pubDate>
        <link>${guid}</link>
        <guid isPermaLink="true">${guid}</guid>
        
        
      </item>`;
}

/**
 * GUIDs, item links, enclosure URLs, and lastBuildDate stay byte-for-byte
 * with the previous feed. The channel link, atom:link, and artwork use https.
 * itunes:complete is omitted: the last episode is 2019-05-24, and the site
 * never says another episode will not be published.
 */
export function buildFeed(episodes: Episode[]): string {
  const items = episodes.map(itemXml).join('\n    \n');
  return `<rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" version="2.0">
  <channel>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <title>${xmlEscape(SITE_TITLE)}</title>
    <description>${xmlEscape(SITE_DESCRIPTION)}</description>
    <link>${SITE_URL}/</link>
    <language>en-us</language>
    <copyright>&#x2117; &amp; &#xA9; 2016 Jeremy Ricketts &amp; Michael Chan</copyright>
    <pubDate>Fri, 24 May 2019 15:16:39 -0700</pubDate>
    <lastBuildDate>Fri, 24 May 2019 15:16:39 -0700</lastBuildDate>
    <generator>Jekyll v3.3.0</generator>
    <itunes:subtitle>Jeremy &amp; Michael Review Bird Calls</itunes:subtitle>
    <itunes:author>Jeremy Ricketts &amp; Michael Chan</itunes:author>
    <itunes:summary>${xmlEscape(SITE_DESCRIPTION)}</itunes:summary>
    <itunes:owner>
      <itunes:name>Jeremy Ricketts &amp; Michael Chan</itunes:name>
      <itunes:email>mijoch+bcr@gmail.com</itunes:email>
    </itunes:owner>
    <itunes:image href="${ARTWORK_URL}" />
    <itunes:category text="Science &amp; Medicine">
      <itunes:category text="Natural Sciences" />
    </itunes:category>
    <itunes:explicit>yes</itunes:explicit>
    
${items}
    
  </channel>
</rss>
`;
}
