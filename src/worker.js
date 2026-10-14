// Office Board Worker
// - /ical?cal=<key>  fetches a private iCal feed server-side (secret ICAL_<KEY>), so the
//   browser never sees the link and there are no CORS problems. Add &debug=1 to inspect.
// - everything else is served from ./public (the board itself).

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/ical") return ical(url, env);
    return env.ASSETS.fetch(request);
  },
};

async function ical(url, env) {
  const key = url.searchParams.get("cal") || "";
  const debug = url.searchParams.has("debug");
  if (!/^[a-z0-9_]+$/i.test(key)) return text("Bad calendar key", 400);

  const name = "ICAL_" + key.toUpperCase();
  const src = (env[name] || "").trim();
  if (!src) {
    const seen = Object.keys(env).filter(k => k !== "ASSETS");
    return text(`${name} isn't set. Add it under the Worker's Settings > Variables and Secrets (not Build variables) as a Secret.\n`
      + `Names this Worker can see: ${seen.length ? seen.join(", ") : "(none)"}`, 404);
  }

  const target = src.replace(/^webcal:/i, "https:");
  let upstream;
  try {
    upstream = await fetch(target, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (OfficeBoard; Cloudflare Workers)",
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

const text = (msg, status) =>
  new Response(msg, { status, headers: { "content-type": "text/plain", "cache-control": "no-store" } });
