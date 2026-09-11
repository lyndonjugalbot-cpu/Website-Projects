# public/ — brand art

Served at the site root by Vite and used automatically. `Brand` falls back
to a CSS wordmark if a file is missing.

| File | Used for |
|------|----------|
| `logo.webp` | Full lockup on the welcome screen (`<Brand>`) |
| `emblem.webp` | Compact top-bar mark + browser favicon |

Both were cropped and edge-feathered from `../art/logo-source.jpeg`
(the original key art) with the small Pillow script used in that commit —
re-run it against a new source if the art changes.
