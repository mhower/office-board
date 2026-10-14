// Cloudflare Pages Function: GET /ical?cal=<key>
// Fetches a private iCal feed server-side so the browser never sees the secret URL
// and doesn't hit CORS. Set one env var per calendar in Pages > Settings > Variables:
//   ICAL_WORK, ICAL_PERSONAL, ICAL_DRIBBLE  (keys match CONFIG.calendars in index.html)

export async function onRequestGet({ request, env }) {
  const key = new URL(request.url).searchParams.get("cal") || "";
  if (!/^[a-z0-9_]+$/i.test(key)) return new Response("Bad calendar key", { status: 400 });

  const src = env["ICAL_" + key.toUpperCase()];
  if (!src) return new Response(`No ICAL_${key.toUpperCase()} variable set`, { status: 404 });

  const upstream = await fetch(src.replace(/^webcal:/i, "https:"), {
    cf: { cacheTtl: 120, cacheEverything: true },
  });
  if (!upstream.ok) return new Response(`Calendar source returned ${upstream.status}`, { status: 502 });

  return new Response(upstream.body, {
    headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "no-store" },
  });
}
