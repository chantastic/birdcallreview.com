import type { APIRoute } from 'astro';
import { SITE_URL, loadEpisodes, pageCount, pageHref } from '../lib/episodes';

export const GET: APIRoute = async () => {
  const episodes = await loadEpisodes();
  const paths = [
    pageHref(1),
    ...Array.from({ length: Math.max(0, pageCount(episodes.length) - 1) }, (_, index) => pageHref(index + 2)),
    '/about/',
    '/credits',
    ...episodes.map((episode) => `/${episode.id}`),
  ];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paths.map((path) => `  <url><loc>${SITE_URL}${path}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n');
  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
