import { ListFilter, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "../config";
import type { Expense, SortOption } from "../types";
import { filterExpensesByCategory, searchExpenses, sortExpenses } from "../utils/expenses";
import { EmptyState } from "./EmptyState";
import { ExpenseItem } from "./ExpenseItem";

interface ExpenseListProps {
  expenses: Expense[];
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
}

const PAGE_SIZE = 10;

export function ExpenseList({ expenses, onEdit, onDelete }: ExpenseListProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ExpenseCategory | "All">("All");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    let result = searchExpenses(expenses, search);
    result = filterExpensesByCategory(result, category);
    result = sortExpenses(result, sortBy);
    return result;
  }, [expenses, search, category, sortBy]);

  const visible = filtered.slice(0, visibleCount);
  const selectClass =
    "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            placeholder="Search description or notes..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-slate-400">
            <ListFilter className="h-4 w-4" />
          </div>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as ExpenseCategory | "All");
              setVisibleCount(PAGE_SIZE);
            }}
            className={selectClass}
            aria-label="Filter by category"
          >
            <option value="All">All categories</option>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className={selectClass}
            aria-label="Sort expenses"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="highest">Highest amount</option>
            <option value="lowest">Lowest amount</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No expenses match your filters"
          description="Try adjusting your search, category filter, or selected date range."
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {visible.map((expense) => (
              <ExpenseItem key={expense.id} expense={expense} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </ul>
          <p className="text-center text-xs text-slate-400">
            Showing {visible.length} of {filtered.length} expense{filtered.length === 1 ? "" : "s"}
          </p>
          {visibleCount < filtered.length && (
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="mx-auto rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Load more
            </button>
          )}
        </>
      )}
    </div>
  );
}
