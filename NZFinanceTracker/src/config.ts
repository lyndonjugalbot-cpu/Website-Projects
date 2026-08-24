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

export const LOCAL_STORAGE_KEYS = {
  expenses: "nz-finance-tracker:expenses",
  budgets: "nz-finance-tracker:budgets",
  sampleDataSeeded: "nz-finance-tracker:sample-seeded",
  theme: "nz-finance-tracker:theme",
} as const;
