# Prompt: PyWots product video

Paste everything below the line into Claude Code, opened in the `PyWots/` folder, with Opus 5.5.

---

You are a senior motion designer and creative director who also writes production code. Make an outstanding product video for **PyWots**. It should make a beginner who has never coded want to start today, and it should make an Etsy shopper trust the product enough to click Buy. Work autonomously. Don't stop to ask me questions; make decisions, state them briefly, and get on with it. Finish only when you have looked at your own output and it is genuinely good.

## The product (all of this is true; don't claim anything beyond it)

**PyWots** is a paid, gamified web app that teaches Python in 100 days. It runs in the browser on phone, tablet and computer, with nothing to install. It's sold on Etsy as a **12-month access pass** (a code the buyer claims with their Etsy order number, then redeems in the app). It's made in New Zealand, so prices are in NZ$; don't state a price in the video unless I give you one.

How it plays:
- **The Awakening Test:** 5 questions set your starting stats, so beginners and people who know some Python both start in the right place.
- **A new Gate every day:** a System message with the day's goal, a Skill Codex of key ideas in plain English, and quick drills (predict the output, fill the blank, reorder lines).
- **The Daily Dungeon:** you write **real Python 3** in an in-browser editor and press Submit. The app runs your code and grades it against tests, and each test ticks green. A hint is available and you can retry as often as you like.
- **11 boss Gates** (Days 7, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100). Beating one ranks you up along E → D → C → B → A → S → S+ → SS → SS+ → SSS → National → Monarch. A "RANK UP" burst plays.
- XP and levels, daily streaks with a Penalty if you miss a day (lesson XP is halved until you clear that day's Gate), 14 achievements, and a six-stat radar sheet (Syntax, Control, Data, Functions, Objects, Craft).
- A daily-quest reminder: a full-screen "NOTIFICATION — will you accept?" System window. Buyers sign in with email and password, and progress syncs to their account.
- The 100 days run in 10 phases: Foundations, Data, Functions, Craft, Objects, Mastery, Applied Python, Algorithms, Idioms, Shipping.

**Be honest about content.** Only Days 1–10 are fully written guided lessons. Days 11–100 each have a set topic and goal plus a real graded challenge, and their guided lessons are still being written. Don't imply that all 100 days are fully guided. "100-day path" and "11 boss Gates" are fine; "100 hand-written lessons" is not.

**Never say "Solo Leveling"** in any text, caption, or file name. It's someone else's trademark, and naming it in a paid listing risks a takedown. The visual theme carries the vibe on its own. No fake testimonials, ratings, user counts, press logos or "as seen on".

## Audience and feeling

Beginners, career-changers, students, and parents buying for a teen. They've tried a course or a video series and drifted away. The promise: **learning to code becomes a game you actually come back to**, and you write real code from day one. The feeling to land: a slightly dangerous, cinematic "you've been chosen" energy, with Python at its centre and no jokes at the learner's expense. Confident and slick, never cringe.

## Deliverables

Put everything in `etsy/video/promo/` (create it). Don't touch or overwrite `etsy/video/intro.html` or `etsy/video/out/intro.mp4`, which is the existing 15 s Etsy listing video.

1. **`promo-45s-16x9.mp4`**: 45 seconds, 1920×1080, 30 fps, H.264, the hero film for the website and YouTube. Give it its own arc: hook (0–5 s), the problem, what PyWots is, the daily loop (lesson → Dungeon → tests turning green), the boss Gate and RANK UP, the 100-day Tower, the daily summons, then the end card. Aim for a real build in intensity, with quiet moments that let the best beat land. Use the strongest single moment (the RANK UP burst) as a deliberate high point.
2. **`promo-30s-9x16.mp4`**: a 30 s vertical cut, 1080×1920, for Reels, TikTok and Shorts. Recompose it for a phone; don't crop the widescreen version. Keep key content out of the top 250 px and bottom 400 px, where the app UI covers it. The first second must hook.
3. **`promo-15s-etsy.mp4`**: a tighter 15 s, 1920×1080 edit for Etsy (silent; Etsy plays listing video muted, and accepts 3–15 s, up to 100 MB). It must still read well with no sound and loop cleanly.
4. **Audio.** Etsy needs silence, but the other two should have sound. Make original music and sound design **with code** (ffmpeg's audio filters and/or a small synth written in JS or Python; check what's installed). Aim for a tense pulse that builds, a riser into RANK UP, a satisfying "tick" for each green test, and a soft UI whoosh on scene changes. Keep levels sensible (music around −16 LUFS, no clipping). Don't download stock or copyrighted music. If you can't make audio you're proud of, ship silent versions and say so plainly, rather than shipping something bad.
5. **`notes.md`**: 10–15 lines: your creative decisions, what each file is for, how to regenerate, and anything you'd improve next.

## Use what already exists (don't reinvent it)

- **Real app screenshots:** `etsy/images/source/shots/` (phone 390×797 @3×, desktop 1440×900 @2×). Includes the Awakening Test, Today with lessons, the graded Dungeon, boss Gate + RANK UP burst, LEVEL UP burst, the Tower (including `tower-list-phone.png`, all 100 rows in one tall image), the Hunter stat sheet, and the daily summons. Regenerate or add shots with `etsy/images/source/capture.mjs`; it builds the app locally without the sign-in wall and can run real Python through Pyodide for genuine graded results. **Every app screen in the video must be a real screenshot or a real recording of the app. Never draw fake app UI.**
- **Real motion from the app:** you're allowed to record the actual running app with Playwright (`etsy/video/node_modules/playwright-core`, Chrome at `/Applications/Google Chrome.app`) to get authentic animations such as the boot splash, the RANK UP burst, typing code and the tests ticking green. This is likely to beat a still screenshot for the hero moments. Run `npm run dev` in `PyWots/` (with Supabase env vars unset the app is open and local), or reuse the local-build approach in `capture.mjs`.
- **Brand system (from `PyWots.jsx`):** background `#05060F`; cyan `#38E1FF`; violet `#9A7BFF`; magenta `#E56BFF`; gold `#FFC24B`; green `#3DF0A9`; red `#FF5C7A`; text `#D3DDFB`. Fonts Orbitron (display) and Rajdhani, loaded from Google Fonts. The octagon emblem with the "Py" monogram and flame is in `PyWots.jsx` (`Emblem`). Clipped-corner panels with cyan corner ticks, a drifting rune/glyph backdrop, a grid and a scanline. Look at `etsy/images/*.jpg` (the eight Etsy photos) and `etsy/video/intro.html` to see the established style and match it, then go further.
- **Rendering pipeline that works:** `etsy/video/render.mjs` steps a deterministic `window.seek(frame)` HTML page frame by frame through Playwright and pipes JPEG frames into ffmpeg (`ffmpeg-static`, already in `etsy/video/node_modules`). No CSS animations, so every frame is reproducible. You may reuse and extend it (add an audio mux step, or a mode for other frame sizes), or use another approach if it produces a better film, but keep it scripted and re-runnable.

## Craft standards (this is what "amazing" means here)

- **Story first.** Every scene has one job and one idea on screen. Cut anything that doesn't earn its seconds.
- **Type:** big, few words, on screen long enough to read twice. Keep captions inside the safe areas. Never let text sit on busy UI without a scrim or clear separation.
- **Motion:** deliberate easing (ease-out for entrances, ease-in-out for moves), staggered reveals, real parallax and depth on device mockups, camera pushes and lateral moves, and consistent timing and rhythm. Avoid default-looking fades and slides. Sync major beats to the music's pulse and give the video a beat map.
- **Devices:** phone and browser frames should look premium (see the mockups already in `etsy/images/source/mockups.html`), with correct crop and pixel-crisp screens. Render at 1× the target size at minimum; render 2× and downscale if you want extra sharpness.
- **Hero moments:** (a) code being typed and the tests ticking green one by one, (b) the boss Gate clearing into RANK UP, (c) scrolling the Tower through the 10 phases, (d) the System summons window. Make each of these a set piece.
- **End card:** PyWots wordmark, "Learn Python by leveling up", "12 months access", "Phone · Tablet · Computer", and pywots.vercel.app. Nothing more.
- **Loop-friendly:** for the 15 s Etsy cut, make the last frame flow back into the first.
- **Accessibility:** a burned-in caption for every spoken or implied message (the videos are watched on mute), readable contrast, and no flashing faster than 3 per second (the RANK UP flash included).

## How to work and check yourself

1. Read `etsy/images/`, `etsy/video/intro.html`, `etsy/video/render.mjs` and the shots first. Write a one-paragraph creative concept and a shot list with timings before you build.
2. Build scene by scene. After each, render still frames (`node render.mjs stills …`) and **look at them** at full size; don't trust the code. Fix overlaps, clipped text, off-brand colours, blurry crops, awkward pacing.
3. Render each MP4, then decode frames back out of the finished file (with ffmpeg) at several timestamps and inspect them, including the first, middle, the moment before and after each cut, and the last frame. Confirm duration, resolution, frame rate, pixel format (`yuv420p`), `+faststart`, and that the audio track exists (or doesn't, for Etsy). Check file sizes (Etsy ≤ 100 MB).
4. Do one honest critique pass as a demanding creative director would ("Where would a viewer get bored? Where is text too small on a phone? Is the RANK UP moment earned?"), then fix what you find and re-render. Do at least two rounds.
5. Verify every claim on screen against the product facts above. Remove anything you can't back up.

## Constraints

- Don't modify the app's source (`PyWots.jsx`, `curriculum.js`, `src/`) or anything in `supabase/`.
- Don't commit, deploy or publish anything. Leave files in place for me to review.
- Don't download stock footage, music, fonts or images beyond Google Fonts (Orbitron, Rajdhani). Don't use any real person's likeness.
- Keep temporary files in a scratch directory outside the repo, and keep large intermediates out of git (add a `.gitignore` in `promo/` if needed).
- If a tool or dependency is missing, install it locally within `etsy/video/` (npm) or work around it. Don't touch global system settings.

When you're done, reply with a short summary: the three (or more) files and their sizes and durations, what's strongest about the film, anything you had to compromise on, and how to re-render. Then stop.
