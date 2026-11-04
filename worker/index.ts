const CANONICAL_ORIGIN = 'https://birdcallreview.com';
const WWW_HOST = 'www.birdcallreview.com';

/** www on either scheme becomes one 301 to the https apex. Other hosts pass through. */
function wwwRedirect(url: URL): string | null {
  if (url.hostname !== WWW_HOST) return null;
  const target = new URL(CANONICAL_ORIGIN);
  target.pathname = url.pathname;
  target.search = url.search;
  return target.href;
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const redirectTo = wwwRedirect(url);
    if (redirectTo) return Response.redirect(redirectTo, 301);

    const asset = await env.ASSETS.fetch(request);
    if (url.pathname !== '/feed.xml' || !asset.ok) return asset;

    const headers = new Headers(asset.headers);
    headers.set('Content-Type', 'application/rss+xml; charset=utf-8');
    return new Response(asset.body, {
      status: asset.status,
      statusText: asset.statusText,
      headers,
    });
  },
} satisfies ExportedHandler<Env>;
