/* Native-only setup. Dynamically imported from src/main.jsx when running
   inside Capacitor, so none of these plugin imports touch the web bundle.

   - Styles the iOS status bar to match the app.
   - Catches the pywots://auth-callback deep link after an OAuth sign-in,
     closes the in-app browser, and completes the Supabase session. */
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { StatusBar, Style } from "@capacitor/status-bar";
import { completeOAuthFromUrl } from "./auth.js";

StatusBar.setStyle({ style: Style.Dark }).catch(() => {});

App.addListener("appUrlOpen", async ({ url }) => {
  if (!url || !url.startsWith("pywots://auth-callback")) return;
  try { await Browser.close(); } catch { /* already closed */ }
  await completeOAuthFromUrl(url);
});
