import { getCollection, type CollectionEntry } from 'astro:content';

export const PAGE_SIZE = 5;
/** Canonical origin for pages, the feed self link, sitemap, and artwork. */
export const SITE_URL = 'https://birdcallreview.com';
/**
 * Episode GUIDs and item permalinks stay on this historical origin.
 * Changing them would make podcast clients treat the archive as new episodes.
 */
export const LEGACY_PERMALINK_ORIGIN = 'http://birdcallreview.com';
export const ARTWORK_URL = `${SITE_URL}/img/logo.png`;
export const SITE_TITLE = 'Bird Call Review';
export const SITE_DESCRIPTION =
  "Bird calls are incredibly diverse. But are they all good? Are some just okay? Can a bird call be sexy? Let's find out.";
export const AUDIO_ORIGIN = 'https://episodes.birdcallreview.com';
// Players and feed enclosures share the R2 host. That host now serves every file.
export const PLAYBACK_ORIGIN = AUDIO_ORIGIN;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type Episode = CollectionEntry<'episodes'>;

export function audioUrl(filename: string): string {
  return `${AUDIO_ORIGIN}/${filename}`;
}

export function playbackUrl(filename: string): string {
  return `${PLAYBACK_ORIGIN}/${filename}`;
}

export function episodeHtml(body: string | undefined): string {
  return `${(body ?? '').trim()}\n`;
}

export function displayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

export function xmlDateTime(isoDate: string): string {
  return `${isoDate}T20:00:00+00:00`;
}

export function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(text: string, length = 160): string {
  if (text.length <= length) return text;
  return `${text.slice(0, length - 3)}...`;
}

export function pageCount(total: number): number {
  return Math.ceil(total / PAGE_SIZE);
}

export function pageHref(page: number): string {
  return page <= 1 ? '/' : `/${page}/`;
}

export async function loadEpisodes(): Promise<Episode[]> {
  const episodes = await getCollection('episodes');
  return episodes.sort((a, b) => (a.data.date < b.data.date ? 1 : a.data.date > b.data.date ? -1 : a.id.localeCompare(b.id)));
}

export function episodesForPage(episodes: Episode[], page: number): Episode[] {
  const start = (page - 1) * PAGE_SIZE;
  return episodes.slice(start, start + PAGE_SIZE);
}
