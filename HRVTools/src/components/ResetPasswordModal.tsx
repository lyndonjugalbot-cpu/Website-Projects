import { useAction } from "convex/react";
import { LoaderCircle, X } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { randomPassword } from "../lib/password";

const inputClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white";

export function ResetPasswordModal({
  employeeId,
  employeeName,
  onClose,
}: {
  employeeId: Id<"users">;
  employeeName: string;
  onClose: () => void;
}) {
  const resetPassword = useAction(api.passwords.adminResetEmployeePassword);

  const [password, setPassword] = useState(randomPassword());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await resetPassword({ employeeId, newPassword: password });
      setDone(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Reset {employeeName}&apos;s password
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Password reset. Share the new password with {employeeName}:
            </p>
            <div className="rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800">
              <p className="font-mono text-slate-700 dark:text-slate-200">{done}</p>
            </div>
            <button
              onClick={onClose}
              className="mt-1 self-end rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                New password
              </label>
              <div className="flex gap-2">
                <input
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`flex-1 ${inputClass}`}
                />
                <button
                  type="button"
                  onClick={() => setPassword(randomPassword())}
                  className="rounded-lg border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Generate
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting && <LoaderCircle size={16} className="animate-spin" />}
              Reset password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
