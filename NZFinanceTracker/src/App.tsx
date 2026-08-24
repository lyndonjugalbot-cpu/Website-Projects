import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { BarChart3, Info, ListChecks, NotebookPen, PiggyBank as PiggyBankIcon, Settings, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { BudgetCard } from "./components/BudgetCard";
import { BudgetSettings } from "./components/BudgetSettings";
import { ConfirmationDialog } from "./components/ConfirmationDialog";
import { Dashboard } from "./components/Dashboard";
import { DataManagement } from "./components/DataManagement";
import { ExpenseForm } from "./components/ExpenseForm";
import { ExpenseList } from "./components/ExpenseList";
import { Forecast } from "./components/Forecast";
import { Header } from "./components/Header";
import { Modal } from "./components/Modal";
import { MonthlyReport } from "./components/MonthlyReport";
import { Notes } from "./components/Notes";
import { ReportControls } from "./components/ReportControls";
import { SavingsGoalCard } from "./components/SavingsGoalCard";
import { WeeklyReport } from "./components/WeeklyReport";
import { SignInForm } from "./components/auth/SignInForm";
import { NoteForm } from "./components/notes/NoteForm";
import { ReminderBanner } from "./components/notes/ReminderBanner";
import { FinanceProvider, useFinance } from "./context/FinanceContext";
import { useDarkMode } from "./hooks/useDarkMode";
import { useReportRange } from "./hooks/useReportRange";
import { useSyncNoteReminders } from "./hooks/useSyncNoteReminders";
import type { Expense, ExpenseInput, Note, NoteInput } from "./types";
import { filterExpensesByRange, getTotalSpent } from "./utils/expenses";
import { cancelNoteReminder, scheduleNoteReminder } from "./utils/notifications";

type TabId = "report" | "expenses" | "budget" | "forecast" | "notes" | "data";

const TABS: { id: TabId; label: string; icon: typeof BarChart3 }[] = [
  { id: "report", label: "Report", icon: BarChart3 },
  { id: "expenses", label: "Expenses", icon: ListChecks },
  { id: "budget", label: "Budget", icon: PiggyBankIcon },
  { id: "forecast", label: "Forecast", icon: TrendingUp },
  { id: "notes", label: "Notes", icon: NotebookPen },
  { id: "data", label: "Data", icon: Settings },
];

function AppContent() {
  const [isDark, setIsDark] = useDarkMode();
  const {
    expenses,
    budgets,
    recurringExpenses,
    notes,
    isLoading,
    addExpense,
    updateExpense,
    deleteExpense,
    importExpenses,
    clearAllData,
    setBudgets,
    addRecurringExpense,
    updateRecurringExpense,
    toggleRecurringExpenseActive,
    deleteRecurringExpense,
    addNote,
    updateNote,
    deleteNote,
    uploadNoteAudio,
    retryNoteTranscription,
  } = useFinance();
  const reportRange = useReportRange();
  useSyncNoteReminders(notes);

  const [activeTab, setActiveTab] = useState<TabId>("report");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isNoteFormOpen, setIsNoteFormOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [deletingNote, setDeletingNote] = useState<Note | null>(null);

  const rangeExpenses = useMemo(
    () => filterExpensesByRange(expenses, reportRange.range),
    [expenses, reportRange.range],
  );
  const budgetAmount = reportRange.view === "weekly" ? budgets.weekly : budgets.monthly;
  const totalSpentInRange = getTotalSpent(rangeExpenses);

  const openAddForm = () => {
    setEditingExpense(null);
    setIsFormOpen(true);
  };
  const openEditForm = (expense: Expense) => {
    setEditingExpense(expense);
    setIsFormOpen(true);
  };
  const closeForm = () => {
    setIsFormOpen(false);
    setEditingExpense(null);
  };

  const handleSubmitExpense = (input: ExpenseInput) => {
    if (editingExpense) {
      updateExpense(editingExpense.id, input);
    } else {
      addExpense(input);
    }
    closeForm();
  };

  const openAddNoteForm = () => {
    setEditingNote(null);
    setIsNoteFormOpen(true);
  };
  const openEditNoteForm = (note: Note) => {
    setEditingNote(note);
    setIsNoteFormOpen(true);
  };
  const closeNoteForm = () => {
    setIsNoteFormOpen(false);
    setEditingNote(null);
  };

  const applyNoteReminder = async (id: string, input: NoteInput) => {
    await cancelNoteReminder(id);
    if (input.reminderEnabled) {
      await scheduleNoteReminder({
        id,
        ...input,
        audioUrl: null,
        transcript: null,
        transcriptionStatus: "none",
        createdAt: "",
        updatedAt: "",
      });
    }
  };

  const handleSubmitNote = async (input: NoteInput, pendingAudioBlob: Blob | null) => {
    try {
      if (editingNote) {
        updateNote(editingNote.id, input);
        if (pendingAudioBlob) await uploadNoteAudio(editingNote.id, pendingAudioBlob);
        await applyNoteReminder(editingNote.id, input);
      } else {
        const newId = await addNote(input);
        if (pendingAudioBlob) await uploadNoteAudio(newId, pendingAudioBlob);
        await applyNoteReminder(newId, input);
      }
    } catch (error) {
      console.error("Failed to save note", error);
    } finally {
      closeNoteForm();
    }
  };

  const handleDeleteNote = async () => {
    try {
      if (deletingNote) {
        await cancelNoteReminder(deletingNote.id);
        deleteNote(deletingNote.id);
      }
    } catch (error) {
      console.error("Failed to delete note", error);
    } finally {
      setDeletingNote(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600 dark:border-slate-700 dark:border-t-brand-500" />
          <p className="text-sm">Connecting…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Header
        isDark={isDark}
        onToggleDark={() => setIsDark((prev) => !prev)}
        onAddExpense={openAddForm}
        onAddNote={openAddNoteForm}
      />

      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6">
        <div className="flex items-start gap-2 rounded-xl border border-ocean-100 bg-ocean-50 px-4 py-2.5 text-sm text-ocean-800 dark:border-ocean-800/60 dark:bg-ocean-900/30 dark:text-ocean-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Your expense data syncs in real time across every device you open this app on, and is retained for a
            maximum of three months.
          </p>
        </div>

        <ReminderBanner notes={notes} />

        <ReportControls
          view={reportRange.view}
          setView={reportRange.setView}
          quickOption={reportRange.quickOption}
          applyQuickOption={reportRange.applyQuickOption}
          range={reportRange.range}
          setCustomRange={reportRange.setCustomRange}
          jumpToDate={reportRange.jumpToDate}
        />

        <Dashboard expenses={rangeExpenses} budgetAmount={budgetAmount} onAddExpense={openAddForm} />

        <nav className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>

        <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
          {activeTab === "report" &&
            (reportRange.view === "weekly" ? (
              <WeeklyReport expenses={rangeExpenses} range={reportRange.range} />
            ) : (
              <MonthlyReport expenses={rangeExpenses} range={reportRange.range} />
            ))}

          {activeTab === "expenses" && (
            <ExpenseList expenses={rangeExpenses} onEdit={openEditForm} onDelete={setDeletingExpense} />
          )}

          {activeTab === "budget" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Budget tracking</h2>
                <button
                  type="button"
                  onClick={() => setIsBudgetModalOpen(true)}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Configure budgets
                </button>
              </div>
              <BudgetCard
                view={reportRange.view}
                budgets={budgets}
                totalSpent={totalSpentInRange}
                onConfigure={() => setIsBudgetModalOpen(true)}
              />
              <SavingsGoalCard
                view={reportRange.view}
                budgets={budgets}
                totalSpent={totalSpentInRange}
                onConfigure={() => setIsBudgetModalOpen(true)}
              />
            </div>
          )}

          {activeTab === "forecast" && (
            <Forecast
              expenses={expenses}
              budgets={budgets}
              recurringExpenses={recurringExpenses}
              onAddRecurring={addRecurringExpense}
              onUpdateRecurring={updateRecurringExpense}
              onToggleRecurringActive={toggleRecurringExpenseActive}
              onDeleteRecurring={deleteRecurringExpense}
              onConfigureSettings={() => setIsBudgetModalOpen(true)}
            />
          )}

          {activeTab === "notes" && <Notes notes={notes} onEdit={openEditNoteForm} onDelete={setDeletingNote} />}

          {activeTab === "data" && (
            <DataManagement
              allExpenses={expenses}
              reportExpenses={rangeExpenses}
              onImport={importExpenses}
              onClearAll={clearAllData}
            />
          )}
        </section>
      </main>

      <Modal isOpen={isFormOpen} onClose={closeForm} title={editingExpense ? "Edit expense" : "Add expense"}>
        <ExpenseForm initialExpense={editingExpense ?? undefined} onSubmit={handleSubmitExpense} onCancel={closeForm} />
      </Modal>

      <Modal isOpen={isBudgetModalOpen} onClose={() => setIsBudgetModalOpen(false)} title="Budget settings">
        <BudgetSettings
          budgets={budgets}
          onSave={(next) => {
            setBudgets(next);
            setIsBudgetModalOpen(false);
          }}
          onCancel={() => setIsBudgetModalOpen(false)}
        />
      </Modal>

      <ConfirmationDialog
        isOpen={deletingExpense !== null}
        title="Delete expense?"
        message={
          deletingExpense
            ? `Are you sure you want to delete "${deletingExpense.description}"? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={() => {
          if (deletingExpense) deleteExpense(deletingExpense.id);
          setDeletingExpense(null);
        }}
        onCancel={() => setDeletingExpense(null)}
      />

      <Modal isOpen={isNoteFormOpen} onClose={closeNoteForm} title={editingNote ? "Edit note" : "Add note"}>
        <NoteForm
          initialNote={editingNote ?? undefined}
          onSubmit={handleSubmitNote}
          onCancel={closeNoteForm}
          onRetryTranscription={editingNote ? () => retryNoteTranscription(editingNote.id) : undefined}
        />
      </Modal>

      <ConfirmationDialog
        isOpen={deletingNote !== null}
        title="Delete note?"
        message={
          deletingNote ? `Are you sure you want to delete "${deletingNote.title || "this note"}"? This cannot be undone.` : ""
        }
        confirmLabel="Delete"
        onConfirm={handleDeleteNote}
        onCancel={() => setDeletingNote(null)}
      />
    </div>
  );
}

function App() {
  return (
    <>
      <AuthLoading>
        <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
          <div className="flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600 dark:border-slate-700 dark:border-t-brand-500" />
            <p className="text-sm">Connecting…</p>
          </div>
        </div>
      </AuthLoading>
      <Unauthenticated>
        <SignInForm />
      </Unauthenticated>
      <Authenticated>
        <FinanceProvider>
          <AppContent />
        </FinanceProvider>
      </Authenticated>
    </>
  );
}

export default App;
