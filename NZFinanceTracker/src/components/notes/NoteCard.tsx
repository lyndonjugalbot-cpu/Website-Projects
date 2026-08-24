import { Bell, ListChecks, Mic, Pencil, Trash2 } from "lucide-react";
import { NOTE_COLORS, type NoteColorKey } from "../../config";
import type { Note } from "../../types";
import { formatNZDate } from "../../utils/date";

interface NoteCardProps {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
}

export function NoteCard({ note, onEdit, onDelete }: NoteCardProps) {
  const palette = NOTE_COLORS[(note.color as NoteColorKey) in NOTE_COLORS ? (note.color as NoteColorKey) : "default"];
  const doneCount = note.checklistItems.filter((item) => item.done).length;

  return (
    <div
      className={`group flex flex-col gap-2 rounded-2xl border p-4 shadow-sm transition hover:shadow-md ${palette.bg} ${palette.border}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          {note.title || (note.type === "checklist" ? "Checklist" : "Note")}
        </h3>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(note)}
            aria-label={`Edit ${note.title || "note"}`}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/60 hover:text-ocean-600 dark:hover:bg-slate-800/60 dark:hover:text-ocean-400"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(note)}
            aria-label={`Delete ${note.title || "note"}`}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {note.type === "checklist" ? (
        <ul className="flex flex-col gap-1">
          {note.checklistItems.slice(0, 6).map((item) => (
            <li
              key={item.id}
              className={`flex items-center gap-2 text-sm ${
                item.done ? "text-slate-400 line-through" : "text-slate-700 dark:text-slate-300"
              }`}
            >
              <ListChecks className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{item.text}</span>
            </li>
          ))}
          {note.checklistItems.length > 6 && (
            <li className="text-xs text-slate-400">+{note.checklistItems.length - 6} more</li>
          )}
          {note.checklistItems.length > 0 && (
            <li className="mt-1 text-xs text-slate-400">
              {doneCount}/{note.checklistItems.length} done
            </li>
          )}
        </ul>
      ) : (
        note.body && <p className="line-clamp-4 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{note.body}</p>
      )}

      {note.audioUrl && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Mic className="h-3.5 w-3.5 shrink-0" />
          {note.transcriptionStatus === "pending" && <span>Transcribing…</span>}
          {note.transcriptionStatus === "done" && note.transcript && (
            <span className="truncate italic">"{note.transcript}"</span>
          )}
          {note.transcriptionStatus === "failed" && <span>Transcription failed</span>}
        </div>
      )}

      {note.scheduledDate && (
        <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          {note.reminderEnabled && <Bell className="h-3.5 w-3.5 shrink-0" />}
          <span>
            {formatNZDate(note.scheduledDate)}
            {note.scheduledTime ? ` · ${note.scheduledTime}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
