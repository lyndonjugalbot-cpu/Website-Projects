# Deploying Wots Diagram Generator to Firebase Hosting

Static Vite build only — no backend. Shares the Firebase project
`hrvtools-app-28b2b` with HRVTools and NZFinanceTracker, on its own hosting
site `wots-diagram-generator`.

## One-time setup

Already logged in as `lyndon.jugalbot@gmail.com`. Create the hosting site once:

```sh
cd DiagramMaker
npx --yes firebase-tools hosting:sites:create wots-diagram-generator --project hrvtools-app-28b2b
```

(`.firebaserc` and `firebase.json` are already committed — the site key in
`firebase.json` targets `wots-diagram-generator`.)

## Deploy (every time)

```sh
cd DiagramMaker
npm run deploy:firebase
```

(= `npm run build` then `firebase deploy --only hosting`.)

Live at <https://wots-diagram-generator.web.app> and
<https://wots-diagram-generator.firebaseapp.com>.

## Config

- `firebase.json` — `site: wots-diagram-generator`, `public: dist`, SPA rewrite
  (`**` → `/index.html`), long cache on `/assets/**`, no-cache on `/index.html`.
- `.firebaserc` — default project `hrvtools-app-28b2b`.
