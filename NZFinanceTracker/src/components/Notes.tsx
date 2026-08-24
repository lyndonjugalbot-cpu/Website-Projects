import { CalendarDays, Rows3 } from "lucide-react";
import { useState } from "react";
import type { Note } from "../types";
import { NotesCalendar } from "./notes/NotesCalendar";
import { NotesList } from "./notes/NotesList";

type NotesView = "list" | "calendar";

interface NotesProps {
  notes: Note[];
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
}

export function Notes({ notes, onEdit, onDelete }: NotesProps) {
  const [view, setView] = useState<NotesView>("list");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-lg border border-slate-200 p-1 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setView("list")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
            view === "list"
              ? "bg-brand-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          <Rows3 className="h-4 w-4" />
          All notes
        </button>
        <button
          type="button"
          onClick={() => setView("calendar")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
            view === "calendar"
              ? "bg-brand-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          <CalendarDays className="h-4 w-4" />
          Calendar
        </button>
      </div>

      {view === "list" ? (
        <NotesList notes={notes} onEdit={onEdit} onDelete={onDelete} />
      ) : (
        <NotesCalendar notes={notes} onEdit={onEdit} onDelete={onDelete} />
      )}
    </div>
  );
}
