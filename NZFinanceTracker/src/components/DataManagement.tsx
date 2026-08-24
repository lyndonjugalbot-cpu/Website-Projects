import { AlertCircle, CheckCircle2, Download, FileJson, FileSpreadsheet, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import type { Expense } from "../types";
import { downloadFile, expensesToCSV, expensesToJSON, parseImportedExpenses } from "../utils/csv";
import { formatNZDate } from "../utils/date";
import { getOldestExpenseDate } from "../utils/expenses";
import { ConfirmationDialog } from "./ConfirmationDialog";

interface DataManagementProps {
  allExpenses: Expense[];
  reportExpenses: Expense[];
  onImport: (expenses: Expense[]) => Promise<number>;
  onClearAll: () => void;
}

export function DataManagement({ allExpenses, reportExpenses, onImport, onClearAll }: DataManagementProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const oldestDate = getOldestExpenseDate(allExpenses);
  const timestamp = new Date().toISOString().slice(0, 10);

  const handleExportAllCSV = () => {
    downloadFile(expensesToCSV(allExpenses), `nz-finance-tracker-all-${timestamp}.csv`, "text/csv;charset=utf-8;");
  };

  const handleExportAllJSON = () => {
    downloadFile(expensesToJSON(allExpenses), `nz-finance-tracker-all-${timestamp}.json`, "application/json;charset=utf-8;");
  };

  const handleExportReportCSV = () => {
    downloadFile(expensesToCSV(reportExpenses), `nz-finance-tracker-report-${timestamp}.csv`, "text/csv;charset=utf-8;");
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const raw = typeof reader.result === "string" ? reader.result : "";
      const result = parseImportedExpenses(raw);
      if (result.error) {
        setImportMessage({ type: "error", text: result.error });
        return;
      }
      if (result.valid.length === 0) {
        setImportMessage({
          type: "error",
          text: `No valid expenses found. ${result.rejectedCount} record(s) were rejected.`,
        });
        return;
      }
      const addedCount = await onImport(result.valid);
      setImportMessage({
        type: "success",
        text: `Imported ${addedCount} expense(s).${result.rejectedCount > 0 ? ` ${result.rejectedCount} record(s) were rejected as invalid or outside the retention period.` : ""}`,
      });
    };
    reader.onerror = () => setImportMessage({ type: "error", text: "Could not read the selected file." });
    reader.readAsText(file);
  };

  const buttonClass =
    "flex items-center gap-2 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800";

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="Retained expenses" value={String(allExpenses.length)} />
        <StatBox label="Oldest retained expense" value={oldestDate ? formatNZDate(oldestDate) : "—"} />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">Export</h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleExportAllCSV} className={buttonClass}>
            <FileSpreadsheet className="h-4 w-4" /> All data (CSV)
          </button>
          <button type="button" onClick={handleExportAllJSON} className={buttonClass}>
            <FileJson className="h-4 w-4" /> All data (JSON)
          </button>
          <button type="button" onClick={handleExportReportCSV} className={buttonClass}>
            <Download className="h-4 w-4" /> Current report (CSV)
          </button>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">Import</h3>
        <button type="button" onClick={handleImportClick} className={buttonClass}>
          <Upload className="h-4 w-4" /> Import from JSON file
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleFileSelected} />
        {importMessage && (
          <p
            className={`mt-2 flex items-center gap-1.5 text-sm ${
              importMessage.type === "success" ? "text-brand-600 dark:text-brand-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {importMessage.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            {importMessage.text}
          </p>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">Danger zone</h3>
        <button
          type="button"
          onClick={() => setConfirmClearOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-red-200 px-3.5 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          <Trash2 className="h-4 w-4" /> Clear all data
        </button>
      </div>

      <ConfirmationDialog
        isOpen={confirmClearOpen}
        title="Clear all data?"
        message="This will permanently delete all expenses, budgets, recurring bills, and notes on your account. This action cannot be undone."
        confirmLabel="Clear everything"
        onConfirm={() => {
          onClearAll();
          setConfirmClearOpen(false);
        }}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}
