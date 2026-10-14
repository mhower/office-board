// Office Board Worker
// - /ical?cal=<key>  fetches a private iCal feed server-side (secret ICAL_<KEY>), so the
//   browser never sees the link and there are no CORS problems. Add &debug=1 to inspect.
// - /games  CU women's basketball schedule, results and record from ESPN's public feed.
// - everything else is served from ./public (the board itself).

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/ical") return ical(url, env);
    if (url.pathname === "/games") return games(url);
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

/* ---------- CU WBB schedule + record (ESPN public feed) ---------- */
const ESPN_TEAM = "38"; // Colorado Buffaloes, women's college basketball
const ESPN = `https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/teams/${ESPN_TEAM}/schedule`;

async function games(url) {
  const season = url.searchParams.get("season");
  const q = season ? `&season=${encodeURIComponent(season)}` : "";
  try {
    const [reg, post] = await Promise.all([2, 3].map(async st => {
      const r = await fetch(`${ESPN}?seasontype=${st}${q}`, { cf: { cacheTtl: 120, cacheEverything: true } });
      if (!r.ok) { if (st === 2) throw new Error(`ESPN returned ${r.status}`); return null; }
      return r.json();
    }));
    const body = shapeSchedule(reg, post);
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } catch (e) {
    return text(`Couldn't load the schedule (${e.message})`, 502);
  }
}

function shapeSchedule(reg, post) {
  const seen = new Set();
  const evs = [...(reg?.events || []), ...(post?.events || [])].filter(e => !seen.has(e.id) && seen.add(e.id));
  const num = s => s == null ? null : typeof s === "object" ? (s.displayValue ?? s.value ?? null) : s;
  const rank = c => { const r = c?.curatedRank?.current; return r && r <= 25 ? r : null; };
  const rec = (c, type) => (c?.record || []).find(r => r.type === type)?.displayValue || null;

  const events = evs.map(ev => {
    const c = ev.competitions?.[0] || {};
    const cu = (c.competitors || []).find(x => x.team?.id === ESPN_TEAM || x.id === ESPN_TEAM) || {};
    const op = (c.competitors || []).find(x => x !== cu) || {};
    const st = c.status?.type || ev.status?.type || {};
    return {
      date: ev.date,
      timeValid: c.timeValid ?? ev.timeValid ?? true,
      home: cu.homeAway === "home",
      neutral: !!c.neutralSite,
      opp: op.team?.shortDisplayName || op.team?.displayName || "TBD",
      oppAbbr: op.team?.abbreviation || "",
      oppRank: rank(op),
      cuRank: rank(cu),
      venue: c.venue?.fullName || "",
      city: [c.venue?.address?.city, c.venue?.address?.state].filter(Boolean).join(", "),
      tv: (c.broadcasts || []).map(b => b.media?.shortName || b.names?.[0]).filter(Boolean),
      state: st.state || "pre",
      detail: st.shortDetail || "",
      cuScore: num(cu.score),
      oppScore: num(op.score),
      win: st.state === "post" ? cu.winner === true : null,
      overall: rec(cu, "total"),
      conf: rec(cu, "vsconf"),
    };
  }).sort((a, b) => new Date(a.date) - new Date(b.date));

  const done = events.filter(e => e.state === "post" && e.cuScore != null);
  const last = done[done.length - 1];
  let streak = null;
  if (last) {
    let n = 0;
    for (let i = done.length - 1; i >= 0 && done[i].win === last.win; i--) n++;
    streak = `${last.win ? "W" : "L"}${n}`;
  }
  const wins = done.filter(e => e.win).length;
  return {
    season: reg?.season?.displayName || null,
    events,
    record: {
      overall: last?.overall || `${wins}-${done.length - wins}`,
      conf: last?.conf || null,
      streak,
      played: done.length,
    },
    standing: reg?.team?.standingSummary || null,
    updated: new Date().toISOString(),
  };
}
