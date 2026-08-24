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

/** No-ops on web; the in-app reminder banner covers that case instead (browsers can't reliably fire alarms when closed). */
export async function scheduleNoteReminder(note: Note): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (!note.reminderEnabled || !note.scheduledDate) return;

  const permission = await LocalNotifications.requestPermissions();
  if (permission.display !== "granted") return;

  const [hours, minutes] = (note.scheduledTime ?? "09:00").split(":").map(Number);
  const at = new Date(note.scheduledDate);
  at.setHours(hours, minutes, 0, 0);
  if (at.getTime() <= Date.now()) return;

  await LocalNotifications.schedule({
    notifications: [
      {
        id: getReminderNotificationId(note.id),
        title: note.title || "Reminder",
        body: note.type === "checklist" ? "Checklist reminder" : note.body.slice(0, 100) || "Note reminder",
        schedule: { at },
      },
    ],
  });
}

export async function cancelNoteReminder(noteId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.cancel({ notifications: [{ id: getReminderNotificationId(noteId) }] });
}
