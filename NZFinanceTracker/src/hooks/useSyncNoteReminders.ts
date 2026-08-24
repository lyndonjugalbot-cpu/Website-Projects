import { useEffect } from "react";
import type { Note } from "../types";
import { scheduleNoteReminder } from "../utils/notifications";

/**
 * Keeps native reminders in sync with note data, including reminders that got enabled in the
 * background (e.g. a voice note's schedule auto-filled once its transcript came back) rather
 * than through the form's own submit handler. No-ops on web; scheduling is idempotent so
 * re-running this on every notes update is safe.
 */
export function useSyncNoteReminders(notes: Note[]): void {
  useEffect(() => {
    for (const note of notes) {
      if (note.reminderEnabled && note.scheduledDate) {
        void scheduleNoteReminder(note);
      }
    }
  }, [notes]);
}
