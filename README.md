# Office Board

TV wall display for the CU WBB office: clock, Boulder weather, up-next countdown, and the work calendar, in CU gold over the Flatirons.

No build step. Cloudflare Pages serves the repo root as-is.

## Deploy (Cloudflare Worker, Git-connected)
This repo deploys as a Cloudflare **Worker** with static assets (`wrangler.jsonc`).
1. Cloudflare dashboard → Workers & Pages → the `office-board` Worker is connected to this repo; every push to `main` redeploys.
2. Worker → Settings → Variables and Secrets → add a **Secret** `ICAL_WORK` = your Outlook published ICS link.
3. Zero Trust → Access → add an application for the Worker's domain so only you can see the calendar.
4. Open the Worker URL full-screen on the TV.

Check the feed at `/ical?cal=work&debug=1`.

## Files
- `public/index.html` — the whole board (art is embedded). Edit `CONFIG` near the top of the script for location, calendars and night-dim hours.
- `src/worker.js` — serves the board and the `/ical?cal=work` proxy that fetches the secret ICS link server-side.
- `wrangler.jsonc` — Worker config.
- `assets/` — source art (Flatirons line art and topo contours) as transparent masks, kept for future edits.

## Calendar link (Outlook / M365)
Outlook on the web → Settings → Calendar → Shared calendars → Publish a calendar → choose the calendar, "Can view all details" → copy the **ICS** link.
