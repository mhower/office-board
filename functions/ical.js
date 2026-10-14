// Cloudflare Pages Function: GET /ical?cal=<key>
// Fetches a private iCal feed server-side so the browser never sees the secret URL
// and doesn't hit CORS. Set one Secret per calendar in Pages > Settings > Variables and Secrets
// (Production environment): ICAL_WORK, etc. Keys match CONFIG.calendars in index.html.
// Add &debug=1 to see what the upstream calendar server returned.

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const key = url.searchParams.get("cal") || "";
  const debug = url.searchParams.has("debug");
  if (!/^[a-z0-9_]+$/i.test(key)) return text("Bad calendar key", 400);

  const name = "ICAL_" + key.toUpperCase();
  const src = (env[name] || "").trim();
  if (!src) return text(`${name} isn't set for this deployment. Add it as a Production secret, then redeploy.`, 404);

  const target = src.replace(/^webcal:/i, "https:");
  let upstream;
  try {
    upstream = await fetch(target, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (OfficeBoard; Cloudflare Pages)",
        "Accept": "text/calendar, text/plain, */*",
      },
      cf: { cacheTtl: 120, cacheEverything: true },
    });
  } catch (e) {
    return text(`Couldn't reach the calendar server (${e.message})`, 502);
  }
  const body = await upstream.text();

  if (debug) {
    return new Response(JSON.stringify({
      secret: name,
      host: new URL(target).host,
      path_ends_with: new URL(target).pathname.slice(-12),
      upstream_status: upstream.status,
      upstream_type: upstream.headers.get("content-type"),
      final_url_host: new URL(upstream.url).host,
      looks_like_ics: body.includes("BEGIN:VCALENDAR"),
      event_count: (body.match(/BEGIN:VEVENT/g) || []).length,
      first_200_chars: body.slice(0, 200),
    }, null, 2), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
  }

  if (!upstream.ok) return text(`Calendar server returned ${upstream.status}`, 502);
  if (!body.includes("BEGIN:VCALENDAR")) return text("Calendar link returned a web page, not an .ics file. Use the ICS link, not the HTML one.", 502);

  return new Response(body, {
    headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "no-store" },
  });
}

const text = (msg, status) => new Response(msg, { status, headers: { "content-type": "text/plain", "cache-control": "no-store" } });
