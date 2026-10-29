// Cash-out categories for the POS "Cash out" panel. Client-safe (no database).
//
// `countsAsExpense` decides whether a cash-out also reduces profit in
// Reports/Profit (lib/profit.ts). Salary, cash advances and bills payments are
// left out on purpose: salaries are already counted through Payroll payslips
// and bills through the Bills page, and a cash advance is money lent to an
// employee, not a cost — counting them here too would count the same money
// twice. They still come out of the drawer.
export const CASH_OUT_CATEGORIES = [
  { key: "SALARY", label: "Salary", countsAsExpense: false },
  { key: "CASH_ADVANCE", label: "Cash advance (CA)", countsAsExpense: false },
  { key: "BILLS_PAYMENT", label: "Bills payment", countsAsExpense: false },
  { key: "SUPPLIES", label: "Supplies", countsAsExpense: true },
  { key: "DELIVERY", label: "Delivery / transport", countsAsExpense: true },
  { key: "OTHER", label: "Other", countsAsExpense: true },
] as const;

export type CashOutCategory = (typeof CASH_OUT_CATEGORIES)[number]["key"];

export const CASH_OUT_KEYS = CASH_OUT_CATEGORIES.map((c) => c.key) as [CashOutCategory, ...CashOutCategory[]];

export const CASH_OUT_LABELS: Record<string, string> = Object.fromEntries(CASH_OUT_CATEGORIES.map((c) => [c.key, c.label]));

/** Keys of the categories that also count as operating expenses in profit. */
export const EXPENSE_CASH_OUT_KEYS: string[] = CASH_OUT_CATEGORIES.filter((c) => c.countsAsExpense).map((c) => c.key);
