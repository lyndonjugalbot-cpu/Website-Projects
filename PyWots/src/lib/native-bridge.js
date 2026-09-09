/* Native-only setup. Dynamically imported from src/main.jsx when running
   inside Capacitor, so none of these plugin imports touch the web bundle.

   - Styles the iOS status bar to match the app.
   - Catches the pywots://auth-callback deep link after an OAuth sign-in.
   - Re-applies the daily reminder from the saved pref, and forwards a
     reminder tap to the React layer as a `pywots:summon` event. */
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Preferences } from "@capacitor/preferences";
import { completeOAuthFromUrl } from "./auth.js";
import { applyReminder, onReminderTapped } from "./reminders.js";

StatusBar.setStyle({ style: Style.Dark }).catch(() => {});

App.addListener("appUrlOpen", async ({ url }) => {
  if (!url || !url.startsWith("pywots://auth-callback")) return;
  try { await Browser.close(); } catch { /* already closed */ }
  await completeOAuthFromUrl(url);
});

/* Keep the schedule in sync with whatever the user last set, every launch.
   (Doesn't prompt for permission here — the React layer does that right
   after the Awakening Test / from the settings toggle.) */
(async () => {
  try {
    const raw = (await Preferences.get({ key: "pywots:local:pywots:save:v1" })).value;
    const save = raw ? JSON.parse(raw) : null;
    await applyReminder(save?.reminder);
  } catch { /* no save yet, or plugin unavailable */ }
})();

onReminderTapped(() => {
  window.__pywotsSummon = true;
  window.dispatchEvent(new CustomEvent("pywots:summon"));
});
