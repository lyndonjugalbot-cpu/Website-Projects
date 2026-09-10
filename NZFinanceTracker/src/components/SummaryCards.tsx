import { Receipt, TrendingUp, Wallet, Tag, ArrowUpRight, PiggyBank } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Expense } from "../types";
import { formatNZD } from "../utils/currency";
import { getAveragePurchase, getLargestPurchase, getMostUsedCategory, getTotalSpent } from "../utils/expenses";

interface SummaryCardsProps {
  expenses: Expense[];
  budgetAmount: number | null;
}

interface CardSpec {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  accent: string;
}

export function SummaryCards({ expenses, budgetAmount }: SummaryCardsProps) {
  const total = getTotalSpent(expenses);
  const average = getAveragePurchase(expenses);
  const largest = getLargestPurchase(expenses);
  const topCategory = getMostUsedCategory(expenses);
  const remaining = budgetAmount !== null ? budgetAmount - total : null;

  const cards: CardSpec[] = [
    {
      label: "Total spent",
      value: formatNZD(total),
      icon: Wallet,
      accent: "from-brand-500 to-brand-600",
    },
    {
      label: "Purchases",
      value: String(expenses.length),
      icon: Receipt,
      accent: "from-ocean-500 to-ocean-600",
    },
    {
      label: "Average purchase",
      value: formatNZD(average),
      icon: TrendingUp,
      accent: "from-violet-500 to-violet-600",
    },
    {
      label: "Largest purchase",
      value: largest ? formatNZD(largest.amount) : formatNZD(0),
      sub: largest?.description,
      icon: ArrowUpRight,
      accent: "from-amber-500 to-amber-600",
    },
    {
      label: "Most-used category",
      value: topCategory ?? "—",
      icon: Tag,
      accent: "from-pink-500 to-pink-600",
    },
  ];

  if (budgetAmount !== null) {
    cards.push({
      label: "Left to spend",
      value: formatNZD(remaining ?? 0),
      sub: (remaining ?? 0) < 0 ? "Over the spendable budget" : undefined,
      icon: PiggyBank,
      accent: (remaining ?? 0) < 0 ? "from-red-500 to-red-600" : "from-emerald-500 to-emerald-600",
    });
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="group rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
        >
          <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${card.accent} text-white shadow-sm`}>
            <card.icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{card.label}</p>
          <p className="mt-0.5 truncate text-lg font-bold text-slate-900 dark:text-slate-100">{card.value}</p>
          {card.sub && <p className="mt-0.5 truncate text-xs text-slate-400">{card.sub}</p>}
        </div>
      ))}
    </div>
  );
}
