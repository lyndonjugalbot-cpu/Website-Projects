import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import { CATEGORY_COLORS, EXPENSE_CATEGORIES, type ExpenseCategory } from "../../config";
import { formatNZD, formatNZDCompact } from "../../utils/currency";
import { EmptyState } from "../EmptyState";

interface CategoryBarChartProps {
  totals: Record<ExpenseCategory, number>;
}

export function CategoryBarChart({ totals }: CategoryBarChartProps) {
  const data = EXPENSE_CATEGORIES.map((category) => ({
    name: category,
    value: Math.round(totals[category] * 100) / 100,
  })).filter((entry) => entry.value > 0);

  if (data.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No category spending yet"
        description="Add expenses to compare spending across categories."
      />
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "currentColor" }}
            className="text-slate-400"
            tickFormatter={(value: number) => formatNZDCompact(value)}
          />
          <YAxis
            type="category"
            dataKey="name"
            tickLine={false}
            axisLine={false}
            width={110}
            tick={{ fontSize: 11, fill: "currentColor" }}
            className="text-slate-500"
          />
          <Tooltip
            cursor={{ fill: "rgba(148,163,184,0.12)" }}
            formatter={(value) => [formatNZD(Number(value)), "Spent"]}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid rgb(226 232 240)",
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name as ExpenseCategory]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
