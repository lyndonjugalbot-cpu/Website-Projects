# PCMOTOH Computer Trading — website redesign

A one-page static redesign of [pcmotohcebu.com](https://pcmotohcebu.com/), in the brand's
blue, black and white. There's no build step: open `index.html` in a browser, or deploy the
folder as it is to any static host (Vercel, Netlify, Firebase, Cloudflare Pages).

```
index.html             markup, SEO meta, LocalBusiness schema
assets/css/styles.css  theme tokens, layout, animations, responsive rules
assets/js/main.js      nav, scroll reveal, build filters, quote form, open/closed status
assets/img/            logos, nav mark, favicons, Open Graph image
```

## Design

- **Palette:** pure black base, logo royal blue `#0a35d1` with a brighter UI blue `#1f5bff`,
  and white/silver text. Headings use a chrome gradient that matches the metal lettering in the logo.
- **Type:** Archivo Expanded for headings, Inter for body text, JetBrains Mono for labels and specs (Google Fonts).
- **Premium details:** the logo emblem sits behind rotating rings and glass spec chips, a pointer-following
  glow on the cards, a spinning-fan illustration, a film-grain overlay, a brand marquee and the big wordmark in the footer.
- **Sections:** Hero → Brands → Featured builds (filterable) → Services → Process → About → Quote + Visit → Footer.
- **Mobile:** full-screen menu, plus a fixed Call / Quote / Directions bar once you scroll past the hero.

## Logo files

| File | What it is | Used for |
|------|------------|----------|
| `logo-light.jpg` | The client's logo exactly as supplied (black "PC", white background) | schema.org `logo`, light backgrounds |
| `logo.webp` | Reversed version for dark backgrounds: white background removed, black "PC" and tagline turned white, blue untouched | Hero |
| `logo-mark.png` | Just the "P" emblem, transparent | Nav, footer |
| `favicon.png`, `apple-touch-icon.png` | The emblem, square | Browser tab, home screen |
| `og-image.jpg` | Reversed logo on black with a blue glow, 1200×630 | Link previews on Facebook, Messenger, etc. |

I made the reversed logo from the supplied one. If the client's designer has an official
dark-background version, drop it in as `logo.webp` (same proportions) and the other logo files stay as they are.

## Content sources

The address, phone, hours, services, about story, core values and build specs come from the
current pcmotohcebu.com pages. Places to confirm or replace are marked with `EDIT:` comments.

| What | Where | Status |
|------|-------|--------|
| Address, phone, hours | Hero chip, Visit card, footer, JSON-LD | ✅ from the current site |
| Build specs | Builds section | ✅ from the current Builds page. The RTX 3060 build only lists CPU, GPU and board there |
| Build prices | Builds cards ("Quoted on request") | ⚠️ add prices if the client wants them shown |
| Build photos | Builds cards use type-only visuals | ⚠️ swap in real photos of finished builds if available |
| Facebook / Messenger link | Visit card, footer, `FACEBOOK_URL` in `main.js` | ⚠️ confirm the page URL; add an `m.me/…` link if they have one |
| Budget ranges | Quote form `<select>` | ⚠️ placeholder ranges, so check with the client |
| Process steps and "tested under load" copy | Process + Services | ⚠️ confirm it matches how they actually work |
| Brand marquee | Under the hero | ✅ brands that appear in their listed builds |
| Testimonials | — | Left out on purpose. Add real reviews (e.g. from Facebook) if the client shares them |

## How things work

- **Quote form:** no backend. "Send via SMS" opens the visitor's messaging app with the message
  already written, addressed to +63 991 314 3133. "Message on Facebook" copies the message
  and opens the Facebook page. "Quote this build" on a card fills in that build.
- **Open/closed status:** calculated in Manila time (Mon–Sat 10:00–21:00, Sunday by appointment).
  The hours are hard-coded in `main.js` under `updateStatus` if they change.
- **Map:** a Google Maps embed with a CSS filter so it matches the dark theme. The pin comes from
  the search "E-Plaza Tayud Consolacion Cebu". Swap in the exact place embed URL from Google Maps if needed.
- Respects `prefers-reduced-motion`. Supports keyboard navigation with visible focus rings.
- Before launch, update `canonical`, `og:url` and `og:image` in `index.html` if the domain changes.
