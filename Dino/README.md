# DinoMart

A modern, animated e-commerce front-end for **DinoMart** — "Home of DinoFam, Lost Epoch & Pop-Culture Collectibles". Rebuilt from the ground up, inspired by [dinomart.io](https://dinomart.io/), with an **Ember & Jungle** theme (fire orange/red + raptor green on a warm daylight paper background, tuned to be easy on young eyes), smooth scroll animations, and a full client-side shopping flow.

No build step, no framework — just HTML, one CSS file, and vanilla JS.

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Landing: animated hero, brand marquee, categories, featured & best-seller grids, drop countdown, testimonials, newsletter |
| `shop.html` | Full catalogue: faceted filters (category, sub-category, brand, availability, price), sort, live search, URL-synced state, load-more |
| `product.html` | Product detail: generated artwork, quantity, add-to-cart, wishlist, tabs (description / shipping / reviews), related & recently-viewed |
| `wishlist.html` | Saved items, "add all in-stock", clear |
| `cart.html` | Cart page + order summary, promo codes, and a mock multi-field checkout with confirmation |
| `about.html` | Story, values, impact counters, FAQ accordion |
| `policies.html` | Shipping / Refund / Privacy / Terms, scroll-spy nav, mock order tracking, contact form |

## Functionality (parity with the reference + extras)

- **Cart** — persistent (`localStorage`), slide-in drawer on every page, quantity controls, free-shipping progress bar, subtotal
- **Checkout** — promo code (`DINOFAM10`), shipping + tax calc, demo payment form, order confirmation
- **Catalogue** — 50 products across 13 toy sub-categories + 6 shwag sub-categories; filter, sort (best-selling, price, title, date), search, deep-linkable URLs (`shop.html?cat=toys&sub=Funko%20Pop!`)
- **Wishlist** — heart any card, dedicated page, header counter
- **Quick view** — modal preview with add-to-cart from any grid
- **Multi-currency** — USD / EUR / GBP / CAD / AUD / JPY, live re-pricing, persisted
- **Multi-language** — EN / FR toggle for core UI strings
- **Account** — mock sign-in / sign-up modal, persisted session
- **Global search** — modal with instant results
- **Newsletter, contact, order tracking** — all wired with feedback states
- **Recently viewed**, animated counters, live drop countdowns, toast notifications, back-to-top, reduced-motion support, keyboard/ESC handling, responsive down to 360px

## Design / motion

- IntersectionObserver scroll reveals with stagger + a failsafe so content never stays hidden
- Animated gradient hero glows, rising embers, seamless brand marquee
- Card hover lift/glow, drawer & modal transitions, count-up stats
- All product imagery is generated inline SVG (soft pastel gradient + glyph + brand) — zero image assets, fully theme-consistent
- Light, high-contrast palette: dark jungle-charcoal text on warm paper, WCAG-AA body text, softened shadows and glows for comfortable extended viewing
- Fonts: Inter + Space Grotesk (Google Fonts)

## Run locally

```bash
cd Dino
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy (Vercel)

Static site, no framework. `vercel.json` sets `cleanUrls`, caching and security headers. Set the project **Root Directory** to `Dino/`.

---

*Demo storefront — no real payments are processed and no goods ship. Trademarks and franchise names belong to their respective owners; DinoMart is portrayed as an independent retailer of licensed merchandise.*
