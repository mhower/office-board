# Office Board

TV wall display for the CU WBB office: clock, Boulder weather, up-next countdown, and the work calendar, in CU gold over the Flatirons.

No build step. Cloudflare Pages serves the repo root as-is.

## Deploy (Cloudflare Pages, Git-connected)
1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pick this repo.
2. Build settings: Framework preset **None**, build command **empty**, output directory **/** (root).
3. Settings → Variables and Secrets → add Secret `ICAL_WORK` = your Outlook published ICS link. Retry the deployment once after adding it.
4. Zero Trust → Access → add an application for the Pages domain so only you can see the calendar.
5. Open the Pages URL full-screen on the TV.

Every push to `main` redeploys automatically. Other branches get preview URLs.

## Files
- `index.html` — the whole board (art is embedded). Edit `CONFIG` near the top of the script for location, calendars and night-dim hours.
- `functions/ical.js` — `/ical?cal=work` proxy that fetches the secret ICS link server-side.
- `assets/` — source art (Flatirons line art and topo contours) as transparent masks, kept for future edits.

## Calendar link (Outlook / M365)
Outlook on the web → Settings → Calendar → Shared calendars → Publish a calendar → choose the calendar, "Can view all details" → copy the **ICS** link.
