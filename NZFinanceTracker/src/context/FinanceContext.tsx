import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { Budgets, Expense, ExpenseInput, RecurringExpense, RecurringExpenseInput } from "../types";

interface FinanceContextValue {
  expenses: Expense[];
  budgets: Budgets;
  recurringExpenses: RecurringExpense[];
  isLoading: boolean;
  addExpense: (input: ExpenseInput) => void;
  updateExpense: (id: string, input: ExpenseInput) => void;
  deleteExpense: (id: string) => void;
  importExpenses: (imported: Expense[]) => Promise<number>;
  clearAllData: () => void;
  setBudgets: (budgets: Budgets) => void;
  addRecurringExpense: (input: RecurringExpenseInput) => void;
  updateRecurringExpense: (id: string, input: RecurringExpenseInput) => void;
  toggleRecurringExpenseActive: (id: string, active: boolean) => void;
  deleteRecurringExpense: (id: string) => void;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  const expenseDocs = useQuery(api.expenses.list);
  const budgetsDoc = useQuery(api.budgets.get);
  const recurringExpenseDocs = useQuery(api.recurringExpenses.list);

  const addExpenseMutation = useMutation(api.expenses.add);
  const updateExpenseMutation = useMutation(api.expenses.update);
  const removeExpenseMutation = useMutation(api.expenses.remove);
  const importManyMutation = useMutation(api.expenses.importMany);
  const clearAllMutation = useMutation(api.expenses.clearAll);
  const seedSampleMutation = useMutation(api.expenses.seedSampleIfEmpty);
  const setBudgetsMutation = useMutation(api.budgets.set);
  const addRecurringMutation = useMutation(api.recurringExpenses.add);
  const updateRecurringMutation = useMutation(api.recurringExpenses.update);
  const toggleRecurringActiveMutation = useMutation(api.recurringExpenses.toggleActive);
  const removeRecurringMutation = useMutation(api.recurringExpenses.remove);

  const hasRequestedSeed = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || hasRequestedSeed.current) return;
    hasRequestedSeed.current = true;
    void seedSampleMutation({});
  }, [isAuthenticated, seedSampleMutation]);

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

  const recurringExpenses = useMemo<RecurringExpense[]>(
    () =>
      (recurringExpenseDocs ?? []).map((doc) => ({
        id: doc._id,
        description: doc.description,
        amount: doc.amount,
        category: doc.category as RecurringExpense["category"],
        frequency: doc.frequency,
        nextDueDate: doc.nextDueDate,
        active: doc.active,
      })),
    [recurringExpenseDocs],
  );

  const budgets: Budgets = budgetsDoc ?? {
    weekly: null,
    monthly: null,
    savingsWeekly: null,
    savingsMonthly: null,
    startingBalance: null,
    income: null,
  };

  const value = useMemo<FinanceContextValue>(
    () => ({
      expenses,
      budgets,
      recurringExpenses,
      isLoading: expenseDocs === undefined || budgetsDoc === undefined || recurringExpenseDocs === undefined,
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
      addRecurringExpense: (input) => {
        void addRecurringMutation(input);
      },
      updateRecurringExpense: (id, input) => {
        void updateRecurringMutation({ id: id as Id<"recurringExpenses">, ...input });
      },
      toggleRecurringExpenseActive: (id, active) => {
        void toggleRecurringActiveMutation({ id: id as Id<"recurringExpenses">, active });
      },
      deleteRecurringExpense: (id) => {
        void removeRecurringMutation({ id: id as Id<"recurringExpenses"> });
      },
    }),
    [
      expenses,
      budgets,
      recurringExpenses,
      expenseDocs,
      budgetsDoc,
      recurringExpenseDocs,
      addExpenseMutation,
      updateExpenseMutation,
      removeExpenseMutation,
      importManyMutation,
      clearAllMutation,
      setBudgetsMutation,
      addRecurringMutation,
      updateRecurringMutation,
      toggleRecurringActiveMutation,
      removeRecurringMutation,
    ],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used within a FinanceProvider");
  return ctx;
}
