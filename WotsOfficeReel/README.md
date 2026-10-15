# Wots Office: Facebook Reel

A 35-second vertical promo for [wotsoffice.co.nz](https://wotsoffice.co.nz), ready to post as a Facebook Reel.

| File | What it is |
|---|---|
| `wots-office-reel.mp4` | **The Reel.** 1080×1920 (9:16), 30 fps, H.264 + AAC, 35 s, audio at −14 LUFS |
| `wots-office-reel-cover.jpg` | Cover/thumbnail frame (the finished brand screen, matching the mockup) |

## What's in it

| Time | Scene | On screen |
|---|---|---|
| 0–4 s | Hook | "No website yet?" A search bar types *barber near me* and results pop up. "Your customers are searching. Be the one they find." |
| 4–10 s | Brand (laid out like `assets/brand/mockup.png`) | The glowing W logo opens out on the beat drop and a light sweeps across it · **WOTS OFFICE** · Software solutions for real results · *Code that builds what's next.* · Websites. Web Apps. Mobile Apps. Automations. Custom Software Solutions. · five service cards · the laptop/tablet/phone scene rises in |
| 10–25 s | Recent work | Phone screen recordings: Wots Office (wotsoffice.co.nz), Happy Picks (happypicks.ph), PCMOTOH Computer Trading, and two web apps, Self Leveling and WotsBudgetTracker |
| 25–30 s | How it works | 1. Book a chat · 2. See your preview · 3. Go live on your own web address |
| 30–35 s | Call to action | "Let's build yours." A cursor clicks **wotsoffice.co.nz →** · Book an appointment online · lyndon@wotsoffice.co.nz · Philippines \| New Zealand |

Headlines, the URL and the call to action stay inside Facebook's Reels safe area, clear of the top bar, the caption at the bottom and the like/comment buttons on the right.

The soundtrack (`music.py`) is synthesised from scratch: a 120 BPM beat that drops when the logo lands, with key clicks, card pops and a mouse click timed to the picture. There's nothing to license, so it won't be muted for copyright. If you'd rather use a trending sound, choose one in Facebook's Reels editor and turn the original audio down.

## Posting it

1. In the Facebook app, open your Page, tap **Create → Reel**, and pick `wots-office-reel.mp4`.
2. Set `wots-office-reel-cover.jpg` as the cover.
3. Suggested caption:

> No website yet? Your customers are already searching. 🔎
>
> Wots Office builds websites, web apps, mobile apps, automations and custom software for businesses in the Philippines and New Zealand. Code that builds what's next.
>
> 👉 Book an appointment at wotsoffice.co.nz
>
> #WotsOffice #WebDesign #WebApps #SmallBusiness #Philippines #NewZealand

## Editing and re-rendering

- **Words, colours, layout:** `reel.html`. Each scene is a `<section>` with its start/end times (`data-from` / `data-to`), and each animated element has its entrance time in `data-in`. Open the file in a browser to preview it in real time, or add `?t=12.5` to the URL to freeze on one moment. (It needs to be served over HTTP: `npx serve .`)
- **Showcase sites:** `SITES` near the bottom of `reel.html`. Each site is either a full-page screenshot in `assets/work/` (390 px wide pages captured at 2×, cropped to 780×3600) that the phone scrolls through, or a phone screen recording:
  1. `./prep_clip.sh recording.mp4 cafe 2 1.5 150 120` takes 4 s (or `CLIP_LEN`) of the recording from 2 s in, plays it at 1.5× speed, cuts 150 px of status/address bar off the top and 120 px of toolbar off the bottom, and saves `assets/work/cafe.mp4`. It prints the frame count. To stitch several moments, set `SEGMENTS="start:end:speed,…"` (the web app clips were made this way, e.g. `CLIP_LEN=3.7 SEGMENTS="0:0.95:1,16.55:18.05:1.3,21.65:22.8:1"`).
  2. In `SITES`, use `{ clip: "cafe", frames: 96, name: "…", kind: "…", bar: "#…", ink: "#fff" }`. `bar`/`ink` colour the fake status bar to match the site's header.
  3. `render.mjs` unpacks the clip into `out/clips/cafe/` before rendering.
- **Logo and device scene:** `assets/brand/logo-hero.png` (with the blueprint lines), `logo-mark.png` (end card) and `devices.jpg` are cut from the brand mockup `assets/brand/mockup.png` by `python3 make_logo.py`. The logo PNGs are transparent where brightness is opacity, so they glow over the dark background with no box.
- **Music:** `music.py`. If you move a scene, move its sound effects too (the times are listed near the end).

```bash
npm install                       # Playwright (Chromium); needs ffmpeg and Python 3 + numpy too
npm run stills                    # a few frames in out/ for a quick check
npm run build                     # music -> frames -> wots-office-reel.mp4 (takes a few minutes)
```

Fonts: Space Grotesk, Inter and Montserrat (SIL Open Font License), stored in `assets/fonts/`.
