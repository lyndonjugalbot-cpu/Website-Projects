# Wots Office: Facebook Reel

A 33-second vertical promo for [wotsoffice.co.nz](https://wotsoffice.co.nz), ready to post as a Facebook Reel.

| File | What it is |
|---|---|
| `wots-office-reel.mp4` | **The Reel.** 1080×1920 (9:16), 30 fps, H.264 + AAC, 33 s, audio at −14 LUFS |
| `wots-office-reel-cover.jpg` | Cover/thumbnail frame (the logo + tagline shot) |

## What's in it

| Time | Scene | On screen |
|---|---|---|
| 0–4 s | Hook | "No website yet?" A search bar types *barber near me* and results pop up. "Your customers are searching. Be the one they find." |
| 4–8 s | Brand | **Wots Office** · *Code that clicks. Apps that connect.* · Websites & ad design for growing businesses · Onehunga, Auckland |
| 8–13 s | What we do | Websites · Ad design · Web apps |
| 13–23 s | Recent work | A phone scrolls through four real builds: Smart Buzz Barbershop, PCMOTOH, DinoMart, AV Toys |
| 23–28 s | How it works | 1. Book a chat · 2. See your preview · 3. Go live on your own web address |
| 28–33 s | Call to action | "Let's build yours." A cursor clicks **wotsoffice.co.nz →** · Book an appointment online · lyndon@wotsoffice.co.nz |

Headlines, the URL and the call to action stay inside Facebook's Reels safe area, clear of the top bar, the caption at the bottom and the like/comment buttons on the right.

The soundtrack (`music.py`) is synthesised from scratch: a 120 BPM beat that drops when the logo lands, with key clicks, card pops and a mouse click timed to the picture. There's nothing to license, so it won't be muted for copyright. If you'd rather use a trending sound, choose one in Facebook's Reels editor and turn the original audio down.

## Posting it

1. In the Facebook app, open your Page, tap **Create → Reel**, and pick `wots-office-reel.mp4`.
2. Set `wots-office-reel-cover.jpg` as the cover.
3. Suggested caption:

> No website yet? Your customers are already searching. 🔎
>
> Wots Office builds fast, mobile-first websites, scroll-stopping ad designs and handy web apps for growing businesses, right here in Onehunga, Auckland.
>
> 👉 Book an appointment at wotsoffice.co.nz
>
> #WotsOffice #Auckland #Onehunga #SmallBusinessNZ #WebDesign #NZBusiness

## Editing and re-rendering

- **Words, colours, layout:** `reel.html`. Each scene is a `<section>` with its start/end times (`data-from` / `data-to`), and each animated element has its entrance time in `data-in`. Open the file in a browser to preview it in real time, or add `?t=12.5` to the URL to freeze on one moment. (It needs to be served over HTTP: `npx serve .`)
- **Showcase sites:** `SITES` near the bottom of `reel.html`, and the screenshots in `assets/work/` (390 px wide pages captured at 2×, cropped to 780×3600).
- **Music:** `music.py`. If you move a scene, move its sound effects too (the times are listed near the end).

```bash
npm install                       # Playwright (Chromium); needs ffmpeg and Python 3 + numpy too
npm run stills                    # a few frames in out/ for a quick check
npm run build                     # music -> frames -> wots-office-reel.mp4 (takes a few minutes)
```

Fonts: Space Grotesk and Inter (SIL Open Font License), stored in `assets/fonts/`.
