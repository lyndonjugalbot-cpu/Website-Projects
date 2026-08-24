import { useAuthActions } from "@convex-dev/auth/react";
import { LogOut, Moon, NotebookPen, PiggyBank, Plus, Sun } from "lucide-react";

interface HeaderProps {
  isDark: boolean;
  onToggleDark: () => void;
  onAddExpense: () => void;
  onAddNote: () => void;
}

export function Header({ isDark, onToggleDark, onAddExpense, onAddNote }: HeaderProps) {
  const { signOut } = useAuthActions();
  return (
    <header
      className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/85"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-ocean-500 text-white shadow-sm">
            <PiggyBank className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight text-slate-900 dark:text-white">NZ Finance Tracker</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Track your spending. Understand your habits.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleDark}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="Sign out"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onAddNote}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <NotebookPen className="h-4 w-4" />
            Add Note
          </button>
          <button
            type="button"
            onClick={onAddExpense}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Add Expense
          </button>
        </div>
      </div>
    </header>
  );
}
