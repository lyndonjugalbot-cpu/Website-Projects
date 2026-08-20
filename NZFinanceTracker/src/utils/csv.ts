import { EXPENSE_CATEGORIES, type ExpenseCategory } from "../config";
import type { Expense } from "../types";
import { generateId } from "./id";
import { isMoreThanRetentionOld } from "./date";

const CSV_HEADERS = ["Description", "Amount (NZD)", "Category", "Date", "Notes"] as const;

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function expensesToCSV(expenses: Expense[]): string {
  const rows = [
    CSV_HEADERS.join(","),
    ...expenses.map((e) =>
      [
        escapeCsvField(e.description),
        e.amount.toFixed(2),
        escapeCsvField(e.category),
        e.date,
        escapeCsvField(e.notes ?? ""),
      ].join(","),
    ),
  ];
  return rows.join("\n");
}

export function expensesToJSON(expenses: Expense[]): string {
  return JSON.stringify(expenses, null, 2);
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  valid: Expense[];
  rejectedCount: number;
  error?: string;
}

function isValidCategory(value: unknown): value is ExpenseCategory {
  return typeof value === "string" && (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

function isValidISODate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

/** Validates and normalises imported JSON data, discarding anything invalid or outside the retention window. */
export function parseImportedExpenses(raw: string, today: Date = new Date()): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { valid: [], rejectedCount: 0, error: "The file is not valid JSON." };
  }

  if (!Array.isArray(data)) {
    return { valid: [], rejectedCount: 0, error: "The file must contain a JSON array of expenses." };
  }

  const valid: Expense[] = [];
  let rejectedCount = 0;

  for (const item of data) {
    if (
      item &&
      typeof item === "object" &&
      "description" in item &&
      "amount" in item &&
      "category" in item &&
      "date" in item
    ) {
      const candidate = item as Record<string, unknown>;
      const description = typeof candidate.description === "string" ? candidate.description.trim() : "";
      const amount = typeof candidate.amount === "number" ? candidate.amount : Number(candidate.amount);
      const category = candidate.category;
      const date = candidate.date;
      const notes = typeof candidate.notes === "string" ? candidate.notes : "";

      const isValid =
        description.length > 0 &&
        Number.isFinite(amount) &&
        amount > 0 &&
        isValidCategory(category) &&
        isValidISODate(date) &&
        !isMoreThanRetentionOld(date, today) &&
        new Date(date).getTime() <= today.getTime();

      if (isValid) {
        valid.push({
          id: generateId(),
          description,
          amount: Math.round(amount * 100) / 100,
          category,
          date,
          notes,
          createdAt: new Date().toISOString(),
        });
        continue;
      }
    }
    rejectedCount += 1;
  }

  return { valid, rejectedCount };
}
