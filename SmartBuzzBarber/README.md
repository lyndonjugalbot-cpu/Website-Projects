# Smart Buzz Barbershop — website

Static one-page site. No build step. Open `index.html` in a browser, or deploy the
folder as-is to any static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages).

```
index.html            markup
assets/css/styles.css theme + layout + animations
assets/js/script.js   nav, scroll-reveal, count-up, lightbox
assets/img/           logo, work photos, menu poster, favicons
originals/            untouched source screenshots (not used by the site)
```

## Before it goes live — replace the placeholders

Every spot below is marked with an `EDIT:` comment in `index.html`.

| What | Where | Status |
|------|-------|--------|
| Street address | Visit section + footer | ✅ 378 Onehunga Mall, Onehunga, Auckland 1061 |
| Phone number | Visit + Book + footer (`tel:` links) | ✅ 022 033 2279 |
| Google Map pin | Visit section `<iframe src>` | ✅ points at the real address |
| Opening hours | Visit section + footer | ⚠️ still a guess — Mon–Fri 9–6:30, Sat 9–5, Sun 10–4 |
| Email | Visit section | ⚠️ placeholder `hello@smartbuzzbarber.com` (marked `EDIT:`) |
| Social links | Footer | ⚠️ still `#` (marked `EDIT:`) |
| Booking link | Book section button | now a `tel:` call button — swap for an online booking URL if there is one |

Prices in the "Menu board" section were taken from the shop's printed price list
and match the poster image. Update them in `index.html` if they change (and swap
`assets/img/menu-poster.jpg` for a fresh photo of the board).

## Notes

- Fonts load from Google Fonts (Anton / Oswald / Inter) with system fallbacks.
- Respects `prefers-reduced-motion`.
- All images are compressed JP/PNG; total page weight ~2.5 MB.
