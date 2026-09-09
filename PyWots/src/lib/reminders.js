import { LocalNotifications } from "@capacitor/local-notifications";

/* Daily "Daily Quest" reminder.

   iOS can't take over the screen at a scheduled time — no app can. What it
   CAN do is post a normal local notification with action buttons. Tapping it
   (or the Accept action) wakes the app, which then shows the full-screen
   in-app System summons (see <SystemSummons> in PyWots.jsx). */

const DAILY_ID = 9001;
const DEFAULT = { enabled: true, hour: 9, minute: 0 };
export const REMINDER_DEFAULT = DEFAULT;

async function granted(requestIfNeeded) {
  const p = await LocalNotifications.checkPermissions();
  if (p.display === "granted") return true;
  if (!requestIfNeeded) return false;
  const r = await LocalNotifications.requestPermissions();
  return r.display === "granted";
}

/* Cancel + (re)schedule the daily notification from a reminder pref
   ({ enabled, hour, minute }). Idempotent — call it on every launch and on
   every settings change. */
export async function applyReminder(reminder, { requestIfNeeded = false } = {}) {
  const r = { ...DEFAULT, ...(reminder || {}) };
  try {
    await LocalNotifications.registerActionTypes({
      types: [{
        id: "DAILY_QUEST",
        actions: [
          { id: "ACCEPT", title: "Accept" },
          { id: "LATER", title: "Later", destructive: false },
        ],
      }],
    });
    await LocalNotifications.cancel({ notifications: [{ id: DAILY_ID }] });
    if (!r.enabled) return { scheduled: false };
    if (!(await granted(requestIfNeeded))) return { scheduled: false, denied: true };

    await LocalNotifications.schedule({
      notifications: [{
        id: DAILY_ID,
        title: "⟢ NOTIFICATION",
        body: "The Daily Quest has appeared — you have qualified to enter today's Gate. Will you accept?",
        schedule: { on: { hour: r.hour, minute: r.minute }, allowWhileIdle: true },
        actionTypeId: "DAILY_QUEST",
      }],
    });
    return { scheduled: true };
  } catch (e) {
    console.warn("PyWots: reminder scheduling failed.", e?.message || e);
    return { scheduled: false, error: String(e?.message || e) };
  }
}

/* Fire cb when the user taps the reminder or its Accept action (not "Later"). */
export function onReminderTapped(cb) {
  const p = LocalNotifications.addListener("localNotificationActionPerformed", (ev) => {
    if (ev?.notification?.id !== DAILY_ID) return;
    if (ev.actionId === "LATER") return;
    cb(ev);
  });
  return () => { p.then((h) => h.remove()).catch(() => {}); };
}
