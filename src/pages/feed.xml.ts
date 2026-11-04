import type { APIRoute } from 'astro';
import { buildFeed } from '../lib/feed';
import { loadEpisodes } from '../lib/episodes';

export const GET: APIRoute = async () => {
  const episodes = await loadEpisodes();
  return new Response(buildFeed(episodes), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
};
