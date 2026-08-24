import { NotebookPen } from "lucide-react";
import type { Note } from "../../types";
import { EmptyState } from "../EmptyState";
import { NoteCard } from "./NoteCard";

interface NotesListProps {
  notes: Note[];
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
}

export function NotesList({ notes, onEdit, onDelete }: NotesListProps) {
  if (notes.length === 0) {
    return (
      <EmptyState
        icon={NotebookPen}
        title="No notes yet"
        description="Jot down a note, build a checklist, or record a voice memo — add a date to see it on the calendar."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
