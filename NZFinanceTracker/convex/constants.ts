/**
 * Kept in sync with DATA_RETENTION_MONTHS in src/config.ts. Duplicated here
 * (rather than imported) so the Convex deployment has no dependency on the
 * frontend source tree.
 */
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
