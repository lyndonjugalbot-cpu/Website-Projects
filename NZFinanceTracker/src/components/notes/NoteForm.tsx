import { Plus, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NOTE_COLOR_KEYS, NOTE_COLORS, type NoteColorKey } from "../../config";
import type { ChecklistItem, Note, NoteInput, NoteType } from "../../types";
import { generateId } from "../../utils/id";
import { parseScheduleFromText } from "../../utils/scheduleFromText";
import { AudioRecorder } from "./AudioRecorder";

interface NoteFormProps {
  initialNote?: Note;
  onSubmit: (input: NoteInput, pendingAudioBlob: Blob | null) => void;
  onCancel: () => void;
  onRetryTranscription?: () => void;
}

export function NoteForm({ initialNote, onSubmit, onCancel, onRetryTranscription }: NoteFormProps) {
  const [type, setType] = useState<NoteType>(initialNote?.type ?? "text");
  const [title, setTitle] = useState(initialNote?.title ?? "");
  const [body, setBody] = useState(initialNote?.body ?? "");
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(initialNote?.checklistItems ?? []);
  const [newItemText, setNewItemText] = useState("");
  const [color, setColor] = useState<NoteColorKey>((initialNote?.color as NoteColorKey) ?? "default");
  const [scheduledDate, setScheduledDate] = useState(initialNote?.scheduledDate ?? "");
  const [scheduledTime, setScheduledTime] = useState(initialNote?.scheduledTime ?? "09:00");
  const [reminderEnabled, setReminderEnabled] = useState(initialNote?.reminderEnabled ?? false);
  const [pendingAudioBlob, setPendingAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const userEditedScheduleRef = useRef(Boolean(initialNote?.scheduledDate));
  const [autoFillHint, setAutoFillHint] = useState<string | null>(null);

  // Pre-fills the schedule from whatever mentions a date/time: typed text as you compose, or a
  // voice transcript once it's back. Stops touching the fields the moment the user edits them directly.
  useEffect(() => {
    if (userEditedScheduleRef.current) return;
    const textToParse = [
      title,
      type === "text" ? body : checklistItems.map((item) => item.text).join(". "),
      initialNote?.transcript ?? "",
    ]
      .filter(Boolean)
      .join(". ");
    if (!textToParse.trim()) return;

    const parsed = parseScheduleFromText(textToParse);
    if (!parsed) return;

    setScheduledDate(parsed.date);
    if (parsed.time) {
      setScheduledTime(parsed.time);
      setReminderEnabled(true);
    }
    setAutoFillHint(parsed.matchedText);
    // Only re-parse on text changes; the schedule fields themselves are set here, not read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, checklistItems, type, initialNote?.transcript]);

  const markScheduleEditedByUser = () => {
    userEditedScheduleRef.current = true;
    setAutoFillHint(null);
  };

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";
  const labelClass = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

  const addChecklistItem = () => {
    if (!newItemText.trim()) return;
    setChecklistItems((items) => [...items, { id: generateId(), text: newItemText.trim(), done: false }]);
    setNewItemText("");
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const hasContent =
      title.trim() || body.trim() || checklistItems.some((item) => item.text.trim()) || pendingAudioBlob;
    if (!hasContent) {
      setError("Add a title, some content, or a recording before saving.");
      return;
    }
    onSubmit(
      {
        type,
        title: title.trim(),
        body: type === "text" ? body : "",
        checklistItems: type === "checklist" ? checklistItems.filter((item) => item.text.trim()) : [],
        color,
        scheduledDate: scheduledDate || null,
        scheduledTime: scheduledDate ? scheduledTime : null,
        reminderEnabled: Boolean(scheduledDate) && reminderEnabled,
      },
      pendingAudioBlob,
    );
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-lg border border-slate-200 p-1 dark:border-slate-700">
        {(["text", "checklist"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setType(option)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition ${
              type === option
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="noteTitle" className={labelClass}>
          Title
        </label>
        <input
          id="noteTitle"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Pay bills"
          className={inputClass}
        />
      </div>

      {type === "text" ? (
        <div>
          <label htmlFor="noteBody" className={labelClass}>
            Note
          </label>
          <textarea
            id="noteBody"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Write a note…"
            className={inputClass}
          />
        </div>
      ) : (
        <div>
          <p className={labelClass}>Checklist</p>
          <ul className="flex flex-col gap-1.5">
            {checklistItems.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() =>
                    setChecklistItems((items) =>
                      items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)),
                    )
                  }
                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500/30 dark:border-slate-600"
                />
                <input
                  type="text"
                  value={item.text}
                  onChange={(e) =>
                    setChecklistItems((items) =>
                      items.map((i) => (i.id === item.id ? { ...i, text: e.target.value } : i)),
                    )
                  }
                  className={`${inputClass} py-1.5`}
                />
                <button
                  type="button"
                  onClick={() => setChecklistItems((items) => items.filter((i) => i.id !== item.id))}
                  aria-label="Remove item"
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addChecklistItem();
                }
              }}
              placeholder="Add an item…"
              className={inputClass}
            />
            <button
              type="button"
              onClick={addChecklistItem}
              className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Add item"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div>
        <p className={labelClass}>Voice note</p>
        <AudioRecorder
          existingAudioUrl={initialNote?.audioUrl ?? null}
          pendingBlob={pendingAudioBlob}
          onRecorded={setPendingAudioBlob}
          transcript={initialNote?.transcript ?? null}
          transcriptionStatus={pendingAudioBlob ? "none" : (initialNote?.transcriptionStatus ?? "none")}
          onRetryTranscription={onRetryTranscription}
        />
      </div>

      <div>
        <p className={labelClass}>Color</p>
        <div className="flex flex-wrap gap-2">
          {NOTE_COLOR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setColor(key)}
              aria-label={NOTE_COLORS[key].label}
              className={`h-8 w-8 rounded-full border-2 ${NOTE_COLORS[key].bg} ${
                color === key ? "border-brand-600 dark:border-brand-400" : "border-slate-200 dark:border-slate-700"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
        <p className={labelClass}>Schedule (optional)</p>
        {autoFillHint && (
          <p className="-mt-2 flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            Detected "{autoFillHint}" — adjust below if that's not right.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="noteDate" className="sr-only">
              Date
            </label>
            <input
              id="noteDate"
              type="date"
              value={scheduledDate}
              onChange={(e) => {
                markScheduleEditedByUser();
                setScheduledDate(e.target.value);
              }}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="noteTime" className="sr-only">
              Time
            </label>
            <input
              id="noteTime"
              type="time"
              value={scheduledTime}
              onChange={(e) => {
                markScheduleEditedByUser();
                setScheduledTime(e.target.value);
              }}
              disabled={!scheduledDate}
              className={`${inputClass} disabled:opacity-50`}
            />
          </div>
        </div>
        {scheduledDate && (
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={reminderEnabled}
              onChange={(e) => {
                markScheduleEditedByUser();
                setReminderEnabled(e.target.checked);
              }}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/30 dark:border-slate-600"
            />
            Remind me
          </label>
        )}
      </div>

      {error && <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-1 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          {initialNote ? "Save changes" : "Add note"}
        </button>
      </div>
    </form>
  );
}
