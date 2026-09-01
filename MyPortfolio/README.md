# Portfolio — Lyndon Jugalbot

A single-page portfolio showcasing the websites and software I&rsquo;ve built —
client work and personal tools, AI-assisted and not.

Static site, no build step. Open `index.html` in a browser, or deploy the folder
as-is to any static host.

```
index.html              markup + copy
assets/css/styles.css   dark theme, layout, animations
assets/js/main.js       project data + grid render, filtering, reveal, nav, copy-email
assets/img/             portrait.jpg (hero), magazine.jpg (About),
                        accenture.png / usc.png / yoobee.png (Background logos)
originals/              untouched source photos (gitignored, not deployed)
vercel.json             static config + cache headers
```

Sections: hero → Work (filterable project grid) → About → Stack → **Background**
(Accenture / University of San Carlos / Yoobee Colleges) → Contact. The
Background logos sit on light chips; the Yoobee mark is monochrome white so it
gets `filter: invert(1)` (`.path__logo--invert`) to read on the chip. Contact
shows the email as a `mailto:` link plus a JS "Copy" button (clipboard, with an
`execCommand` fallback) in case the visitor has no mail client wired up.

## Theme

Dark base with a single warm accent pulled from the sunset waterfront photo —
`--accent #f6b24a` (gold) into `--accent-2 #e8743c` (ember), with a soft
`--glow` radial behind the hero and contact card. `--sky #2f5163` is the cool
dusk-blue counterpoint used sparingly. Swap the two photos in `assets/img/`
(keep the filenames) to re-skin; if the new photos have a different cast, nudge
those four tokens at the top of `styles.css`.

## Adding or editing a project

Everything on the grid comes from the `PROJECTS` array at the top of
[`assets/js/main.js`](assets/js/main.js). Add an object:

```js
{
  name: "Project name",
  type: "app",            // "app" (full-stack) | "site" (marketing) | "tool"
  category: "E-commerce",  // short label shown above the title
  blurb: "One paragraph on what it is and what's interesting about it.",
  meta: "Client project · one line on scope",
  tags: ["Next.js 15", "Prisma", "Stripe"],
  live: "https://example.com",   // or null
  source: "https://github.com/lyndonjugalbot-cpu/Website-Projects/tree/main/Folder", // or null
}
```

The filter chips map to `type`. The `meta` string is split on ` · ` — the part
before the first separator is bolded. No other file needs to change.

## Notes

- Fonts load from Google Fonts (Space Grotesk / Inter) with system fallbacks.
- Respects `prefers-reduced-motion` — reveals and count-ups are skipped.
- `?v=N` on the CSS/JS links (currently `v=6`) — bump when you change those
  files so returning visitors don&rsquo;t get a stale cache.
- `source:` links point at subfolders of the `Website-Projects` repo; they only
  resolve for visitors if that repo is public. Set to `null` to hide the button
  (Virtual Bridge PH lives outside this repo, so it has no source link).
- All eight projects link to a live deployment.

## Deploy to Vercel

Fully static, no framework. New Project &rarr; import the `Website-Projects`
repo &rarr; set **Root Directory** to `MyPortfolio` &rarr; Framework Preset
**Other** &rarr; Deploy. Or from this folder: `vercel deploy --prod`.
