import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";
import { CATEGORY_COLORS, EXPENSE_CATEGORIES, type ExpenseCategory } from "../../config";
import { formatNZD } from "../../utils/currency";
import { EmptyState } from "../EmptyState";

interface CategoryDonutChartProps {
  totals: Record<ExpenseCategory, number>;
}

export function CategoryDonutChart({ totals }: CategoryDonutChartProps) {
  const data = EXPENSE_CATEGORIES.map((category) => ({
    name: category,
    value: Math.round(totals[category] * 100) / 100,
  })).filter((entry) => entry.value > 0);

  const grandTotal = data.reduce((sum, entry) => sum + entry.value, 0);

  if (data.length === 0) {
    return (
      <EmptyState
        icon={PieChartIcon}
        title="No category spending yet"
        description="Add expenses to see how your spending splits by category."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="h-56 w-full min-w-0 sm:w-1/2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={56}
              outerRadius={84}
              paddingAngle={2}
              cornerRadius={4}
              stroke="var(--chart-surface)"
              strokeWidth={2}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name as ExpenseCategory]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [formatNZD(Number(value)), String(name)]}
              contentStyle={{
                borderRadius: 10,
                border: "1px solid rgb(226 232 240)",
                fontSize: 12,
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-1 flex-col gap-1.5 text-sm">
        {data
          .sort((a, b) => b.value - a.value)
          .map((entry) => (
            <li key={entry.name} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-slate-600 dark:text-slate-300">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[entry.name as ExpenseCategory] }}
                  aria-hidden="true"
                />
                <span className="truncate">{entry.name}</span>
              </span>
              <span className="shrink-0 font-medium tabular-nums text-slate-900 dark:text-slate-100">
                {formatNZD(entry.value)}
                <span className="ml-1 text-xs font-normal text-slate-400">
                  ({Math.round((entry.value / grandTotal) * 100)}%)
                </span>
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}
