import { useMutation } from "convex/react";
import { LoaderCircle, Paperclip, Plus } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export function CoachingLogForm({ employeeId, onCreated }: { employeeId: Id<"users">; onCreated?: () => void }) {
  const generateUploadUrl = useMutation(api.coachingLogs.generateUploadUrl);
  const createLog = useMutation(api.coachingLogs.create);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [coachingOpportunities, setCoachingOpportunities] = useState("");
  const [actionPlan, setActionPlan] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      let recordingStorageId: Id<"_storage"> | undefined;
      let recordingFileName: string | undefined;

      if (file) {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!res.ok) throw new Error("Upload failed");
        const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
        recordingStorageId = storageId;
        recordingFileName = file.name;
      }

      await createLog({
        employeeId,
        date,
        coachingOpportunities,
        actionPlan,
        notes: notes || undefined,
        recordingStorageId,
        recordingFileName,
      });

      setCoachingOpportunities("");
      setActionPlan("");
      setNotes("");
      setFile(null);
      setDate(new Date().toISOString().slice(0, 10));
      onCreated?.();
    } catch {
      setError("Could not save the coaching log. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Date</label>
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:w-48"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Coaching opportunities</label>
        <textarea
          required
          rows={3}
          value={coachingOpportunities}
          onChange={(e) => setCoachingOpportunities(e.target.value)}
          placeholder="What was observed / needs improvement?"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Action plan</label>
        <textarea
          required
          rows={3}
          value={actionPlan}
          onChange={(e) => setActionPlan(e.target.value)}
          placeholder="Agreed next steps and follow-up"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes (optional)</label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Call recording (optional)</label>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
          <Paperclip size={16} />
          {file ? file.name : "Choose audio file"}
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="flex items-center justify-center gap-2 self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {submitting ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />}
        Save coaching log
      </button>
    </form>
  );
}
