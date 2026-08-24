import { Capacitor } from "@capacitor/core";
import { Bell } from "lucide-react";
import type { Note } from "../../types";
import { toISODateString } from "../../utils/date";

interface ReminderBannerProps {
  notes: Note[];
}

/** Web has no reliable OS-level alarm, so overdue-or-due-today reminders surface here instead. Native relies on the real Local Notification. */
export function ReminderBanner({ notes }: ReminderBannerProps) {
  if (Capacitor.isNativePlatform()) return null;

  const today = toISODateString(new Date());
  const due = notes.filter((note) => note.reminderEnabled && note.scheduledDate && note.scheduledDate <= today);
  if (due.length === 0) return null;

  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
      <Bell className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        {due.length === 1 ? "1 note reminder is" : `${due.length} note reminders are`} due:{" "}
        {due.map((note) => note.title || "Untitled").join(", ")}.
      </p>
    </div>
  );
}
