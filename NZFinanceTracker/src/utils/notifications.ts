import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { Note } from "../types";

/** Deterministic 31-bit id derived from the note's Convex id, so the same note always maps to the same schedulable notification. */
export function getReminderNotificationId(noteId: string): number {
  let hash = 0;
  for (let i = 0; i < noteId.length; i++) {
    hash = (hash * 31 + noteId.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 2147483647) || 1;
}

/**
 * Some native plugin calls have been observed to never resolve (permission dialogs that don't
 * dismiss cleanly, bridge hiccups). Never let that hang the UI that's waiting on it — fall back
 * after a bounded wait instead.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

/** No-ops on web; the in-app reminder banner covers that case instead (browsers can't reliably fire alarms when closed). */
export async function scheduleNoteReminder(note: Note): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (!note.reminderEnabled || !note.scheduledDate) return;

  const permission = await withTimeout(LocalNotifications.requestPermissions(), 5000, { display: "denied" as const });
  if (permission.display !== "granted") return;

  const [hours, minutes] = (note.scheduledTime ?? "09:00").split(":").map(Number);
  const at = new Date(note.scheduledDate);
  at.setHours(hours, minutes, 0, 0);
  if (at.getTime() <= Date.now()) return;

  await withTimeout(
    LocalNotifications.schedule({
      notifications: [
        {
          id: getReminderNotificationId(note.id),
          title: note.title || "Reminder",
          body: note.type === "checklist" ? "Checklist reminder" : note.body.slice(0, 100) || "Note reminder",
          schedule: { at },
        },
      ],
    }),
    5000,
    undefined,
  );
}

export async function cancelNoteReminder(noteId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await withTimeout(
    LocalNotifications.cancel({ notifications: [{ id: getReminderNotificationId(noteId) }] }),
    5000,
    undefined,
  );
}
