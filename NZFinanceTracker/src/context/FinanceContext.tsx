import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type {
  Budgets,
  Expense,
  ExpenseInput,
  Note,
  NoteInput,
  PeriodBudget,
  PeriodBudgetInput,
  RecurringExpense,
  RecurringExpenseInput,
  SavingsEntry,
  SavingsEntryInput,
} from "../types";

interface FinanceContextValue {
  expenses: Expense[];
  budgets: Budgets;
  periodBudgets: PeriodBudget[];
  recurringExpenses: RecurringExpense[];
  savingsEntries: SavingsEntry[];
  notes: Note[];
  isLoading: boolean;
  addExpense: (input: ExpenseInput) => void;
  updateExpense: (id: string, input: ExpenseInput) => void;
  deleteExpense: (id: string) => void;
  importExpenses: (imported: Expense[]) => Promise<number>;
  clearAllData: () => void;
  setBudgets: (budgets: Budgets) => void;
  setPeriodBudget: (input: PeriodBudgetInput) => void;
  addSavingsEntry: (input: SavingsEntryInput) => void;
  updateSavingsEntry: (id: string, input: SavingsEntryInput) => void;
  deleteSavingsEntry: (id: string) => void;
  addRecurringExpense: (input: RecurringExpenseInput) => void;
  updateRecurringExpense: (id: string, input: RecurringExpenseInput) => void;
  toggleRecurringExpenseActive: (id: string, active: boolean) => void;
  deleteRecurringExpense: (id: string) => void;
  addNote: (input: NoteInput) => Promise<string>;
  updateNote: (id: string, input: NoteInput) => void;
  deleteNote: (id: string) => void;
  uploadNoteAudio: (id: string, blob: Blob) => Promise<void>;
  retryNoteTranscription: (id: string) => void;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  const expenseDocs = useQuery(api.expenses.list);
  const budgetsDoc = useQuery(api.budgets.get);
  const periodBudgetDocs = useQuery(api.periodBudgets.list);
  const recurringExpenseDocs = useQuery(api.recurringExpenses.list);
  const savingsEntryDocs = useQuery(api.savings.list);
  const noteDocs = useQuery(api.notes.list);

  const addExpenseMutation = useMutation(api.expenses.add);
  const updateExpenseMutation = useMutation(api.expenses.update);
  const removeExpenseMutation = useMutation(api.expenses.remove);
  const importManyMutation = useMutation(api.expenses.importMany);
  const clearAllMutation = useMutation(api.expenses.clearAll);
  const seedSampleMutation = useMutation(api.expenses.seedSampleIfEmpty);
  const setBudgetsMutation = useMutation(api.budgets.set);
  const setPeriodBudgetMutation = useMutation(api.periodBudgets.set);
  const addSavingsEntryMutation = useMutation(api.savings.add);
  const updateSavingsEntryMutation = useMutation(api.savings.update);
  const removeSavingsEntryMutation = useMutation(api.savings.remove);
  const addRecurringMutation = useMutation(api.recurringExpenses.add);
  const updateRecurringMutation = useMutation(api.recurringExpenses.update);
  const toggleRecurringActiveMutation = useMutation(api.recurringExpenses.toggleActive);
  const removeRecurringMutation = useMutation(api.recurringExpenses.remove);
  const addNoteMutation = useMutation(api.notes.add);
  const updateNoteMutation = useMutation(api.notes.update);
  const removeNoteMutation = useMutation(api.notes.remove);
  const generateUploadUrlMutation = useMutation(api.notes.generateUploadUrl);
  const attachAudioMutation = useMutation(api.notes.attachAudio);
  const retryTranscriptionMutation = useMutation(api.notes.retryTranscription);

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

  const periodBudgets = useMemo<PeriodBudget[]>(
    () =>
      (periodBudgetDocs ?? []).map((doc) => ({
        id: doc._id,
        period: doc.period,
        periodStart: doc.periodStart,
        amount: doc.amount,
      })),
    [periodBudgetDocs],
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

  const savingsEntries = useMemo<SavingsEntry[]>(
    () =>
      (savingsEntryDocs ?? []).map((doc) => ({
        id: doc._id,
        amount: doc.amount,
        date: doc.date,
        note: doc.note,
        source: doc.source,
        createdAt: doc.createdAt,
      })),
    [savingsEntryDocs],
  );

  const notes = useMemo<Note[]>(
    () =>
      (noteDocs ?? []).map((doc) => ({
        id: doc._id,
        type: doc.type,
        title: doc.title,
        body: doc.body,
        checklistItems: doc.checklistItems,
        color: doc.color,
        audioUrl: doc.audioUrl,
        transcript: doc.transcript ?? null,
        transcriptionStatus: doc.transcriptionStatus,
        scheduledDate: doc.scheduledDate,
        scheduledTime: doc.scheduledTime,
        reminderEnabled: doc.reminderEnabled,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      })),
    [noteDocs],
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
      periodBudgets,
      recurringExpenses,
      savingsEntries,
      notes,
      isLoading:
        expenseDocs === undefined ||
        budgetsDoc === undefined ||
        periodBudgetDocs === undefined ||
        recurringExpenseDocs === undefined ||
        savingsEntryDocs === undefined ||
        noteDocs === undefined,
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
      setPeriodBudget: (input) => {
        void setPeriodBudgetMutation(input);
      },
      addSavingsEntry: (input) => {
        void addSavingsEntryMutation(input);
      },
      updateSavingsEntry: (id, input) => {
        void updateSavingsEntryMutation({ id: id as Id<"savingsEntries">, ...input });
      },
      deleteSavingsEntry: (id) => {
        void removeSavingsEntryMutation({ id: id as Id<"savingsEntries"> });
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
      addNote: async (input) => await addNoteMutation(input),
      updateNote: (id, input) => {
        void updateNoteMutation({ id: id as Id<"notes">, ...input });
      },
      deleteNote: (id) => {
        void removeNoteMutation({ id: id as Id<"notes"> });
      },
      uploadNoteAudio: async (id, blob) => {
        const uploadUrl = await generateUploadUrlMutation({});
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": blob.type || "audio/webm" },
          body: blob,
        });
        const { storageId } = await result.json();
        await attachAudioMutation({ id: id as Id<"notes">, storageId });
      },
      retryNoteTranscription: (id) => {
        void retryTranscriptionMutation({ id: id as Id<"notes"> });
      },
    }),
    [
      expenses,
      budgets,
      periodBudgets,
      recurringExpenses,
      savingsEntries,
      notes,
      expenseDocs,
      budgetsDoc,
      periodBudgetDocs,
      recurringExpenseDocs,
      savingsEntryDocs,
      noteDocs,
      addExpenseMutation,
      updateExpenseMutation,
      removeExpenseMutation,
      importManyMutation,
      clearAllMutation,
      setBudgetsMutation,
      setPeriodBudgetMutation,
      addSavingsEntryMutation,
      updateSavingsEntryMutation,
      removeSavingsEntryMutation,
      addRecurringMutation,
      updateRecurringMutation,
      toggleRecurringActiveMutation,
      removeRecurringMutation,
      addNoteMutation,
      updateNoteMutation,
      removeNoteMutation,
      generateUploadUrlMutation,
      attachAudioMutation,
      retryTranscriptionMutation,
    ],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used within a FinanceProvider");
  return ctx;
}
