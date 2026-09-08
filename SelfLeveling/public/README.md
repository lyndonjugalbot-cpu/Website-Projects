# public/ — brand art

Drop the key art here and it is used automatically (served at the site root
by Vite; the `Brand` component falls back to a CSS wordmark if a file is
missing).

| File | Used for | Suggested size |
|------|----------|----------------|
| `logo.png` | Full lockup on the welcome screen (`<Brand>`) | ~1000px wide, transparent PNG |
| `emblem.png` | Compact top-bar mark + browser favicon | square, ~256×256, transparent PNG |

`emblem.png` should be a tight crop of just the crest / sigil, no "SELF
LEVELING" text. Both are optional — without them the app renders the
gradient CSS wordmark instead.
