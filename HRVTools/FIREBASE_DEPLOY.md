# Deploying HRVTools to Firebase Hosting

Firebase Hosting serves the static Vite build only. The backend stays on Convex
production (`bright-parakeet-587`) — nothing to change there. Password auth talks
to Convex over its client connection, which is not origin-restricted, so the app
works from any hosting origin.

## One-time setup

1. **Log in** (opens a browser):

   ```sh
   npx --yes firebase-tools login
   ```

2. **Create a project** — pick a globally-unique id (3–30 chars, lowercase):

   ```sh
   npx --yes firebase-tools projects:create hrvtools-app --display-name "HRVTools"
   ```

   If that id is taken or the command is blocked, create it in the console
   (<https://console.firebase.google.com>) instead — the free **Spark** plan is
   enough for Hosting.

3. **Link this folder to the project** (writes `.firebaserc`):

   ```sh
   cd HRVTools
   npx --yes firebase-tools use --add       # select the project, alias it "default"
   ```

4. **Create the prod env file** `HRVTools/.env.production.local` (git-ignored) so
   the build points at prod Convex — it beats the dev values in `.env.local`:

   ```sh
   printf 'VITE_CONVEX_URL=https://bright-parakeet-587.convex.cloud\nVITE_CONVEX_SITE_URL=https://bright-parakeet-587.convex.site\n' > .env.production.local
   ```

## Deploy (every time)

```sh
cd HRVTools
npm run deploy:firebase
```

(= `npm run build` then `firebase deploy --only hosting`.)

The app goes live at `https://<project-id>.web.app` and
`https://<project-id>.firebaseapp.com`.

## Config

- `firebase.json` — `public: dist`, SPA rewrite (`**` → `/index.html`), long cache
  on `/assets/**`, no-cache on `/index.html`.
- `.firebaserc` — created by `firebase use --add`.
