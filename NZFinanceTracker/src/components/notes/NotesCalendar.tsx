import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import type { Note } from "../../types";
import {
  addMonths,
  formatNZDateObj,
  fromISODateString,
  getDaysInRange,
  getEndOfMonth,
  getEndOfWeek,
  getStartOfMonth,
  getStartOfWeek,
  toISODateString,
} from "../../utils/date";
import { EmptyState } from "../EmptyState";
import { NoteCard } from "./NoteCard";

interface NotesCalendarProps {
  notes: Note[];
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
}

export function NotesCalendar({ notes, onEdit, onDelete }: NotesCalendarProps) {
  const [month, setMonth] = useState(() => getStartOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => toISODateString(new Date()));

  const notesByDate = useMemo(() => {
    const map = new Map<string, Note[]>();
    for (const note of notes) {
      if (!note.scheduledDate) continue;
      const existing = map.get(note.scheduledDate) ?? [];
      existing.push(note);
      map.set(note.scheduledDate, existing);
    }
    return map;
  }, [notes]);

  const gridDays = useMemo(
    () =>
      getDaysInRange({
        start: getStartOfWeek(getStartOfMonth(month)),
        end: getEndOfWeek(getEndOfMonth(month)),
      }),
    [month],
  );

  const selectedNotes = notesByDate.get(selectedDate) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth((m) => getStartOfMonth(addMonths(m, -1)))}
          aria-label="Previous month"
          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{formatNZDateObj(month, "MMMM yyyy")}</p>
        <button
          type="button"
          onClick={() => setMonth((m) => getStartOfMonth(addMonths(m, 1)))}
          aria-label="Next month"
          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-400">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {gridDays.map((day) => {
          const iso = toISODateString(day);
          const inMonth = day.getMonth() === month.getMonth();
          const dayNotes = notesByDate.get(iso) ?? [];
          const isSelected = iso === selectedDate;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setSelectedDate(iso)}
              className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg text-sm transition ${
                isSelected
                  ? "bg-brand-600 text-white"
                  : inMonth
                    ? "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    : "text-slate-300 hover:bg-slate-50 dark:text-slate-700 dark:hover:bg-slate-900"
              }`}
            >
              {day.getDate()}
              {dayNotes.length > 0 && (
                <span
                  className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-brand-500"}`}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
        <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
          {formatNZDateObj(fromISODateString(selectedDate), "EEEE, d MMMM")}
        </p>
        {selectedNotes.length === 0 ? (
          <EmptyState title="Nothing scheduled" description="Notes with a date land here." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {selectedNotes.map((note) => (
              <NoteCard key={note.id} note={note} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
