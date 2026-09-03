import { ArrowDownLeft, ArrowUpRight, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import type { SavingsEntry } from "../types";
import { formatNZD } from "../utils/currency";
import { formatNZDate } from "../utils/date";
import { EmptyState } from "./EmptyState";

interface SavingsEntryListProps {
  entries: SavingsEntry[];
  onEdit: (entry: SavingsEntry) => void;
  onDelete: (entry: SavingsEntry) => void;
}

const PAGE_SIZE = 10;

export function SavingsEntryList({ entries, onEdit, onDelete }: SavingsEntryListProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (entries.length === 0) {
    return (
      <EmptyState
        title="No savings activity yet"
        description="Deposits, withdrawals and automatic goal contributions will show up here."
      />
    );
  }

  const visible = entries.slice(0, visibleCount);

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {visible.map((entry) => {
          const isWithdrawal = entry.amount < 0;
          const isAuto = entry.source !== "manual";
          return (
            <li
              key={entry.id}
              className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 transition hover:border-slate-200 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  isWithdrawal
                    ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                }`}
                aria-hidden="true"
              >
                {isWithdrawal ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {entry.note || (isWithdrawal ? "Withdrawal" : "Deposit")}
                  </p>
                  {isAuto && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-ocean-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ocean-700 dark:bg-ocean-900/40 dark:text-ocean-300">
                      <RefreshCw className="h-2.5 w-2.5" /> Auto
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{formatNZDate(entry.date)}</p>
              </div>
              <p
                className={`shrink-0 text-sm font-semibold tabular-nums ${
                  isWithdrawal ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {isWithdrawal ? "−" : "+"}
                {formatNZD(Math.abs(entry.amount))}
              </p>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onEdit(entry)}
                  aria-label="Edit savings entry"
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-ocean-600 dark:hover:bg-slate-800 dark:hover:text-ocean-400"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(entry)}
                  aria-label="Delete savings entry"
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-center text-xs text-slate-400">
        Showing {visible.length} of {entries.length} {entries.length === 1 ? "entry" : "entries"}
      </p>
      {visibleCount < entries.length && (
        <button
          type="button"
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="mx-auto rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Load more
        </button>
      )}
    </div>
  );
}
