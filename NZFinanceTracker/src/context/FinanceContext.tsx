import { useMutation, useQuery } from "convex/react";
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { Budgets, Expense, ExpenseInput } from "../types";

interface FinanceContextValue {
  expenses: Expense[];
  budgets: Budgets;
  isLoading: boolean;
  addExpense: (input: ExpenseInput) => void;
  updateExpense: (id: string, input: ExpenseInput) => void;
  deleteExpense: (id: string) => void;
  importExpenses: (imported: Expense[]) => Promise<number>;
  clearAllData: () => void;
  setBudgets: (budgets: Budgets) => void;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const expenseDocs = useQuery(api.expenses.list);
  const budgetsDoc = useQuery(api.budgets.get);

  const addExpenseMutation = useMutation(api.expenses.add);
  const updateExpenseMutation = useMutation(api.expenses.update);
  const removeExpenseMutation = useMutation(api.expenses.remove);
  const importManyMutation = useMutation(api.expenses.importMany);
  const clearAllMutation = useMutation(api.expenses.clearAll);
  const seedSampleMutation = useMutation(api.expenses.seedSampleIfEmpty);
  const setBudgetsMutation = useMutation(api.budgets.set);

  const hasRequestedSeed = useRef(false);
  useEffect(() => {
    if (hasRequestedSeed.current) return;
    hasRequestedSeed.current = true;
    void seedSampleMutation({});
  }, [seedSampleMutation]);

  const expenses = useMemo<Expense[]>(
    () =>
      (expenseDocs ?? []).map((doc) => ({
        id: doc._id,
        description: doc.description,
        amount: doc.amount,
        category: doc.category as Expense["category"],
        date: doc.date,
        notes: doc.notes,
        createdAt: doc.createdAt,
        isSample: doc.isSample,
      })),
    [expenseDocs],
  );

  const budgets: Budgets = budgetsDoc ?? { weekly: null, monthly: null };

  const value = useMemo<FinanceContextValue>(
    () => ({
      expenses,
      budgets,
      isLoading: expenseDocs === undefined || budgetsDoc === undefined,
      addExpense: (input) => {
        void addExpenseMutation(input);
      },
      updateExpense: (id, input) => {
        void updateExpenseMutation({ id: id as Id<"expenses">, ...input });
      },
      deleteExpense: (id) => {
        void removeExpenseMutation({ id: id as Id<"expenses"> });
      },
      importExpenses: (imported) =>
        importManyMutation({
          expenses: imported.map(({ description, amount, category, date, notes, createdAt }) => ({
            description,
            amount,
            category,
            date,
            notes,
            createdAt,
          })),
        }),
      clearAllData: () => {
        void clearAllMutation({});
      },
      setBudgets: (next) => {
        void setBudgetsMutation(next);
      },
    }),
    [
      expenses,
      budgets,
      expenseDocs,
      budgetsDoc,
      addExpenseMutation,
      updateExpenseMutation,
      removeExpenseMutation,
      importManyMutation,
      clearAllMutation,
      setBudgetsMutation,
    ],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used within a FinanceProvider");
  return ctx;
}
