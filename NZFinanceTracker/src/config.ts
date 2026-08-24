/** Number of months of expense history to retain. Change this single value to adjust retention. */
export const DATA_RETENTION_MONTHS = 3;

export const EXPENSE_CATEGORIES = [
  "Groceries",
  "Eating out",
  "Transport",
  "Rent or mortgage",
  "Utilities",
  "Shopping",
  "Entertainment",
  "Health",
  "Education",
  "Subscriptions",
  "Other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Categories excluded from savings-suggestion trimming since they're generally non-discretionary. */
export const ESSENTIAL_CATEGORIES: ExpenseCategory[] = ["Rent or mortgage", "Utilities", "Health", "Education"];

export const FREQUENCIES = ["weekly", "fortnightly", "monthly"] as const;

export const FREQUENCY_LABELS: Record<(typeof FREQUENCIES)[number], string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
};

/**
 * Fixed categorical order (never cycled) drawn from a CVD-validated 8-hue palette,
 * extended with 3 additional distinguishable hues for the remaining categories.
 */
export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Groceries: "#2a78d6", // blue
  "Eating out": "#eb6834", // orange
  Transport: "#1baf7a", // aqua
  "Rent or mortgage": "#eda100", // yellow
  Utilities: "#e87ba4", // magenta
  Shopping: "#008300", // green
  Entertainment: "#4a3aa7", // violet
  Health: "#e34948", // red
  Education: "#92400e", // brown
  Subscriptions: "#64748b", // slate
  Other: "#78716c", // stone (catch-all)
};

/** Curated note-card palette; each entry gives a light/dark-safe background + border pair. */
export const NOTE_COLORS = {
  default: { label: "Default", bg: "bg-white dark:bg-slate-900", border: "border-slate-200 dark:border-slate-800" },
  yellow: { label: "Yellow", bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-200 dark:border-amber-900/60" },
  green: { label: "Green", bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-200 dark:border-emerald-900/60" },
  blue: { label: "Blue", bg: "bg-sky-50 dark:bg-sky-950/40", border: "border-sky-200 dark:border-sky-900/60" },
  pink: { label: "Pink", bg: "bg-pink-50 dark:bg-pink-950/40", border: "border-pink-200 dark:border-pink-900/60" },
  purple: { label: "Purple", bg: "bg-violet-50 dark:bg-violet-950/40", border: "border-violet-200 dark:border-violet-900/60" },
  orange: { label: "Orange", bg: "bg-orange-50 dark:bg-orange-950/40", border: "border-orange-200 dark:border-orange-900/60" },
} as const;

export type NoteColorKey = keyof typeof NOTE_COLORS;
export const NOTE_COLOR_KEYS = Object.keys(NOTE_COLORS) as NoteColorKey[];

export const LOCAL_STORAGE_KEYS = {
  expenses: "nz-finance-tracker:expenses",
  budgets: "nz-finance-tracker:budgets",
  sampleDataSeeded: "nz-finance-tracker:sample-seeded",
  theme: "nz-finance-tracker:theme",
} as const;
