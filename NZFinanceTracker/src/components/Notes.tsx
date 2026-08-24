import { CalendarDays, Plus, Rows3 } from "lucide-react";
import { useState } from "react";
import { useFinance } from "../context/FinanceContext";
import type { Note, NoteInput } from "../types";
import { cancelNoteReminder, scheduleNoteReminder } from "../utils/notifications";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { Modal } from "./Modal";
import { NoteForm } from "./notes/NoteForm";
import { NotesCalendar } from "./notes/NotesCalendar";
import { NotesList } from "./notes/NotesList";

type NotesView = "list" | "calendar";

export function Notes() {
  const { notes, addNote, updateNote, deleteNote, uploadNoteAudio, retryNoteTranscription } = useFinance();

  const [view, setView] = useState<NotesView>("list");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [deletingNote, setDeletingNote] = useState<Note | null>(null);

  const openAddForm = () => {
    setEditingNote(null);
    setIsFormOpen(true);
  };
  const openEditForm = (note: Note) => {
    setEditingNote(note);
    setIsFormOpen(true);
  };
  const closeForm = () => {
    setIsFormOpen(false);
    setEditingNote(null);
  };

  const applyReminder = async (id: string, input: NoteInput) => {
    await cancelNoteReminder(id);
    if (input.reminderEnabled) {
      await scheduleNoteReminder({
        id,
        ...input,
        audioUrl: null,
        transcript: null,
        transcriptionStatus: "none",
        createdAt: "",
        updatedAt: "",
      });
    }
  };

  const handleSubmit = async (input: NoteInput, pendingAudioBlob: Blob | null) => {
    if (editingNote) {
      updateNote(editingNote.id, input);
      if (pendingAudioBlob) await uploadNoteAudio(editingNote.id, pendingAudioBlob);
      await applyReminder(editingNote.id, input);
    } else {
      const newId = await addNote(input);
      if (pendingAudioBlob) await uploadNoteAudio(newId, pendingAudioBlob);
      await applyReminder(newId, input);
    }
    closeForm();
  };

  const handleDelete = async () => {
    if (deletingNote) {
      await cancelNoteReminder(deletingNote.id);
      deleteNote(deletingNote.id);
    }
    setDeletingNote(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <button
          type="button"
          onClick={openAddForm}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Add note
        </button>
      </div>

      {view === "list" ? (
        <NotesList notes={notes} onEdit={openEditForm} onDelete={setDeletingNote} />
      ) : (
        <NotesCalendar notes={notes} onEdit={openEditForm} onDelete={setDeletingNote} />
      )}

      <Modal isOpen={isFormOpen} onClose={closeForm} title={editingNote ? "Edit note" : "Add note"}>
        <NoteForm
          initialNote={editingNote ?? undefined}
          onSubmit={handleSubmit}
          onCancel={closeForm}
          onRetryTranscription={editingNote ? () => retryNoteTranscription(editingNote.id) : undefined}
        />
      </Modal>

      <ConfirmationDialog
        isOpen={deletingNote !== null}
        title="Delete note?"
        message={
          deletingNote ? `Are you sure you want to delete "${deletingNote.title || "this note"}"? This cannot be undone.` : ""
        }
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeletingNote(null)}
      />
    </div>
  );
}
