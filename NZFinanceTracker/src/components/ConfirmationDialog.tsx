import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} maxWidthClassName="max-w-sm">
      <div className="flex flex-col items-center gap-3 text-center">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-full ${
            danger ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400" : "bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-400"
          }`}
        >
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
      </div>
      <div className="mt-5 flex justify-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition ${
            danger ? "bg-red-600 hover:bg-red-700" : "bg-brand-600 hover:bg-brand-700"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
