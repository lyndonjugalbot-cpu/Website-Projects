# Etsy listing: PyWots, 12 months access

One listing: **12 months of access** to PyWots, sold as a digital item. Same model as
WotsBudgetTracker: the buyer downloads a PDF, claims an access code with their Etsy order
number, then redeems the code in the app.

Everything in the copy blocks below is ready to paste. Fields are in the order Etsy's listing
form asks for them.

---

## Before you publish

These have to be true before the listing goes live, because the copy promises them:

1. **Switch on accounts and claiming.** The sign-in, redeem and `/claim` flow is
   built, but it only turns on once Supabase is set up. Follow
   [`supabase/README.md`](../supabase/README.md): create the project, run
   `schema.sql`, set the env vars and redeploy, then set the Etsy secrets,
   deploy the two functions and connect the shop. `ETSY_LISTING_IDS` needs this
   listing's ID, so publish the listing first (or as a draft), then set it.
2. **The digital file is ready:** `pdf/PyWots-Access.pdf` (one A4 page, links to
   `https://pywots.vercel.app/claim`). Upload it as the listing's digital file. To change it,
   edit `pdf/access.html` and run `node ../pdf/render.mjs` from `etsy/video`.
3. **Content promise.** Only Days 1–10 are fully written. The description says so, and says
   guided lessons for later days are "being added over time." The app already tells users
   this on the Tower screen, but keep that line only if you plan to keep adding them.

"Solo Leveling" is left out of the title, tags and description on purpose. It's someone
else's trademark, and naming it in a paid listing invites an IP takedown. The theme speaks for
itself in the photos.

---

## Listing settings

| Field | Value |
|---|---|
| Type | **Digital** |
| Who made it? | I did |
| What is it? | A finished product |
| When was it made? | 2020 – 2026 |
| Category | Books, Movies & Music → Books → **Guides & How Tos** (or search "course" in the category picker) |
| Renewal | Automatic |
| Quantity | 999 |
| Digital file | `pdf/PyWots-Access.pdf` (links to `https://pywots.vercel.app/claim`) |
| Materials | Web app, digital access code |
| Photos | See [Photos](#photos) |
| Video | `video/out/intro.mp4` |

**Price** is your call. NZ$29 matches the WotsBudgetTracker 12-month plan. While Days 11–100
are still outline days, a launch price around NZ$19 is easier to justify.

---

## Title (136 / 140)

```
Learn Python Web App, 12 Months Access | Gamified 100-Day Python Challenge for Beginners, Real Code Graded in Your Browser | Coding Game
```

## Tags (13, each 20 characters or fewer)

```
learn python
python course
python for beginners
coding for beginners
learn to code
programming course
python programming
gamified learning
coding game
100 day challenge
computer science
programmer gift
coding gift
```

## Description

```
Learn Python by leveling up. PyWots turns learning to code into a daily quest: every day you get a short lesson and a real coding challenge, and every challenge you clear earns XP, grows your stats and moves you up the Tower.

This listing is for 12 MONTHS of full access.

━━━━━━━━━━━━━━━━━━━━
HOW IT PLAYS
━━━━━━━━━━━━━━━━━━━━

✔ Start with the Awakening Test: 5 quick questions set your starting stats, so beginners and people who already know some Python both start in the right place
✔ Every day opens a new Gate: a System message with the day's goal, a Skill Codex of key ideas in plain English, and quick drills (predict the output, fill the blank, put lines in order)
✔ Then the Daily Dungeon: write real Python in the built-in editor and hit Submit. The app runs your code and checks it against tests, so you know straight away whether it works
✔ Stuck? Reveal a hint and try again as many times as you like
✔ 11 boss Gates. Beat them to rank up from E to D, C, B, A, S and beyond, all the way to Monarch
✔ XP and levels, daily streaks, 14 achievements and a six-stat sheet (Syntax, Control, Data, Functions, Objects, Craft)
✔ A daily quest reminder at the time you choose
✔ Miss a day and a Penalty halves your lesson XP until you clear that day's Gate, so there's a reason to show up

━━━━━━━━━━━━━━━━━━━━
THE 100-DAY TOWER
━━━━━━━━━━━━━━━━━━━━

10 phases, from your very first print() to shipping a real program:

01–10 Foundations · 11–20 Data · 21–30 Functions · 31–40 Craft · 41–50 Objects · 51–60 Mastery · 61–70 Applied Python · 71–80 Algorithms · 81–90 Idioms · 91–100 Shipping

━━━━━━━━━━━━━━━━━━━━
WHAT'S INSIDE RIGHT NOW
━━━━━━━━━━━━━━━━━━━━

• Days 1–10 (Foundations) are fully guided: teaching notes, drills, a coding challenge each day and two boss Gates.
• Days 11–100 each have a set topic and goal, plus a real graded coding challenge from a practice set for that skill, so you can keep climbing the whole Tower. Their guided lessons are still being written and are being added over time.

━━━━━━━━━━━━━━━━━━━━
HOW IT WORKS
━━━━━━━━━━━━━━━━━━━━

1. Buy this listing and download the PDF from Etsy (You → Purchases).
2. Open the claim link in the PDF and enter your Etsy order number. You'll get your access code straight away.
3. Open PyWots, create your account and enter the code. Your 12 months start when you redeem it.

Buying more than one? You'll get one code per item, so the extra codes can be given as gifts.

━━━━━━━━━━━━━━━━━━━━
GOOD TO KNOW
━━━━━━━━━━━━━━━━━━━━

• This is a web app, not a printable or a video course. It runs in any modern browser (Chrome, Safari, Edge, Firefox) on a phone, tablet or computer. There's nothing to install.
• Python runs right inside your browser. The first coding challenge downloads the Python engine (about 6 MB) once.
• An internet connection is needed.
• Typing code is easiest on a computer or a tablet with a keyboard, but everything works on a phone.
• In a browser, the daily reminder appears while PyWots is open.
• You sign in with an email and password. Your progress is saved to your account, so you can pick up on another device.
• Your code is shown once when you claim it, so save it. Redeem it within a year of claiming.
• Renewing early never wastes time. A new code adds 12 months on top of what you have left.
• When your 12 months end, PyWots asks for a new code. Your progress stays saved on your account, so you carry on where you left off.

━━━━━━━━━━━━━━━━━━━━
QUESTIONS?
━━━━━━━━━━━━━━━━━━━━

Message me on Etsy. If your code doesn't arrive or anything isn't working, I'll sort it out.

As this is a digital product, I can't accept returns, but please get in touch if something's wrong.
```

The account, renewal and expiry lines match how the app works:
`redeem_access_code()` in `supabase/schema.sql` adds 365 days on top of any time
left, codes expire a year after they're issued, and an expired account keeps its
progress and shows a "redeem a new code" screen. If you add Google or Apple
sign-in (`VITE_OAUTH_PROVIDERS`), change "an email and password" to "email,
Google or Apple".

---

## Photos

Files are in [`images/`](images/). They're 3000 × 2250 px (4:3, Etsy's recommended size) and
under 1 MB each, since Etsy warns bigger files may not finish uploading. Upload in this order:

| # | File | Shows |
|---|---|---|
| 1 | `01-hero.jpg` | Main photo: headline, browser + phone, 12 MONTHS ACCESS badge |
| 2 | `02-real-python.jpg` | A Daily Dungeon, submitted and graded, every test passing |
| 3 | `03-lessons.jpg` | Day 9 System message + Skill Codex, and an answered "predict the output" drill |
| 4 | `04-tower.jpg` | The 100-day Tower and the 10 phases, with the Days 1–10 / 11–100 note |
| 5 | `05-ranks.jpg` | E → Monarch ladder, Hunter stat sheet, a real RANK UP moment |
| 6 | `06-daily-quest.jpg` | The daily System summons, reminder, streaks, penalty |
| 7 | `07-how-it-works.jpg` | Buy → claim code → redeem |
| 8 | `08-whats-included.jpg` | Checklist of what 12 months gets you |

Every app screen in the photos is a real screenshot of the live app (pywots.vercel.app),
taken with a save made by replaying real day clears, so the XP, stats and ranks are what a
real player would have. The Dungeon shots ran real Python and were graded by the app.

The code on `07-how-it-works.jpg` (`PY12-7KQM-X2PD`) is labelled "Example code." It's in
the real format the database issues (`PY12-` + 8 characters with no 0/O/1/I/L).

## Video

`video/out/intro.mp4`: 15 s, 1920 × 1080, 30 fps, no sound (Etsy plays listing videos muted
and accepts 3–15 s). It loops cleanly: the last frame fades back into the first. The first
frame shows the title card, so Etsy's cover frame isn't blank.

1. **Hook**: PyWots emblem, "Learn Python. Level up."
2. **Write real Python**: a Dungeon is submitted and each test ticks green
3. **Beat the boss Gates**: the Day 10 Gate cleared → RANK UP, C-class
4. **Climb the Tower**: phone scrolls the 100-day Tower from Day 1 to the current day
5. **Rank up from E to Monarch**: Hunter stat sheet + the daily summons
6. **End card**: 12 MONTHS ACCESS badge, "Learn Python by leveling up. Nothing to install."

---

## Regenerating

Everything is scripted, so after an app change you can refresh all the media in about 5
minutes. It needs Google Chrome and a network connection (the Dungeon shots load Python
from its CDN).

```
cd etsy/video
npm install          # once: playwright-core + ffmpeg-static
npm run screens      # real app screenshots → images/source/shots/
npm run images       # the 8 photos → images/*.jpg
npm run video        # the video → video/out/intro.mp4
```

- Photo layouts: `images/source/mockups.html` (one `<section>` per photo; open it in Chrome
  with `#hero`, `#python`, … to preview).
- Video: `video/intro.html` (every frame is driven by `seek(frame)`); `npm run stills` writes
  sample frames to `video/stills/` for a quick check.
- App states and shots: `images/source/capture.mjs`. It builds the app from this repo with the
  Supabase keys blanked, so the shots show the game rather than the sign-in screen. Set
  `PYWOTS_URL` to capture a running site instead.

---

## After the listing is live

1. Set the listing ID for claiming (it's the number in the listing URL):
   `supabase secrets set ETSY_LISTING_IDS=<listing id>`
2. Set `VITE_ETSY_LISTING_URL` in Vercel to the listing URL and redeploy. That turns on the
   "Get 12 months on Etsy" links on the sign-in, redeem and account screens.
3. Test with a real order: `/claim` → code → redeem.
