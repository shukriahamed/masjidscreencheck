# Masjid Digital Display — Masjidur Rahman, Mannar

Vanilla HTML/CSS/JS, no build step. Open `index.html` (or serve the folder) on the TV. Installable as a PWA and works offline.

## Layouts (Admin → Colours & Themes → Screen Layout)
Signature (default) · Ultra Wide · Simplicity · Classic · Table · Minimal.
Five colour palettes (Islamic Blue default, Royal Gold, Emerald Green, Modern Dark, White & Gold) plus custom colours.

## Home-screen slides (glossy + transparent glass)
The mosque photo is the base; slides fade in over it, then fade out so the photo shows again (gap in Admin → Clock Settings, default 10 s).
Every round is: **digital clock → next prayer (Athan + Iqamah + live countdown) → ONE Hadith / Quran / Dua saying**. The saying moves on to the next one each round. Active announcements, if any, are added at the end of the round. Add or switch off sayings in Admin → Hadith & Slides.

## Prayer list
The prayer whose time is running is filled with the *active prayer colour* (Admin → Colours & Themes; text colour adapts automatically).
**Fridays:** Luhar is replaced by **Jummah**, using the Jummah Prayer time and Jummah Iqamah time from Admin → Jummah Mode (edit them any week). The Athan / Iqamah screens and the next-prayer slide follow those times.

## Screens (all derived from the clock, so they survive reloads)
- **Time to Athan** – last N minutes before Athan (progress bar or globe style with distance to Makkah).
- **Athan** – for the configured duration.
- **Towards Iqamah** – cream countdown screen with scrolling messages.
- **Iqamah** – prayer starting.
- **Straighten the rows picture** – shown full-screen for 10 minutes after the Iqamah screen (Admin → Iqamah Settings: on/off, minutes, upload your own picture).
- **Jummah picture** – on Fridays the picture after Iqamah is your custom Jummah picture (Admin → Jummah Mode; falls back to the straighten-the-rows picture). Default 20 minutes.
- **Jummah information screen** – Fridays, from (khutbah time − lead minutes) until the Jummah Iqamah.

## Preview screens any time
URL: `index.html?demo=pre|athan|iqamah|now|all` (add `&freeze` to hold the numbers, `&prayer=asr` to choose the prayer).
Keys: Ctrl+Shift+T (all), 1 (pre), 2 (athan), 3 (iqamah countdown), 4 (iqamah now), 5 (straighten-the-rows picture), 6 (Jummah picture).
`?demo=shaf` previews the picture; add `&jummah` for the Jummah one.

## Admin
Prayer times, Iqamah lead/screen seconds/messages, Athan style, Hijri offset, sunrise range, slideshow gap, sliders for every size. Default PIN is set in Admin → Advanced.
Settings are versioned (v3); old look settings are reset once on upgrade, prayer times and content are kept.

## Fonts / offline
Fonts load from Google Fonts when online, with fallbacks otherwise. For fully offline use, put woff2 files in `assets/fonts/` and add `@font-face` rules in `css/style.css`.

## Logo & photo
Upload your real logo and background photo in Admin → Mosque Info / Wallpapers (defaults are placeholder SVGs).

## Footer credit
"Powered by SoftSoLab - Shukri Muheeth" sits in the footer (bottom centre). Position/size: Admin → Layout & Sizes.


## Hosting on GitHub + Vercel (images & settings stored on the server)

Everything you change in the admin page (settings, prayer times, slides, **wallpapers, logo, Jummah / straighten-the-rows pictures, athan audio**) is saved to **Vercel Blob**, so you can edit from any phone/laptop and the TV updates itself within a minute. Each browser keeps a local copy for offline use.

### One-time setup
1. Put this folder in a GitHub repo (the `api/` folder, `package.json` and `vercel.json` must be in the repo root).
2. On vercel.com → **Add New → Project** → import the repo → Deploy (no build settings needed).
3. In the project: **Storage → Create → Blob** → connect it to the project (this adds `BLOB_READ_WRITE_TOKEN` automatically). Keep the store **Public**.
4. **Settings → Environment Variables** → add `ADMIN_TOKEN` = any long secret you choose. **Redeploy**.
5. Open `https://your-site.vercel.app/admin.html`, enter the PIN, then paste the `ADMIN_TOKEN` when asked (asked once per browser).
   - If you already set things up on a local copy, they are uploaded to the server the first time you save.
6. Open `https://your-site.vercel.app/` on the TV.

### Notes
- Uploads are limited to ~4 MB each (photos are auto-shrunk to 2560px; keep athan audio under 4 MB).
- Anyone can *view* the display, but only someone with the `ADMIN_TOKEN` can change anything on the server.
- Running locally (`npx serve .`) has no `/api`, so everything stays in the browser exactly as before. To test with the API locally use `npx vercel dev`.
- Display pages check for changes every 60 seconds and reload when something changed.
