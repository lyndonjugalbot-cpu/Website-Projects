import { TrendingUp } from "lucide-react";
import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatWeekLabel } from "../lib/weeks";
import type { MetricDoc } from "../types";

// Fixed categorical order — never reassigned per filter, never cycled.
const SERIES_COLORS = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#4a3aa7", // violet
  "#e34948", // red
  "#008300", // green
];

export function MetricsChart({ metrics }: { metrics: MetricDoc[] }) {
  const { rows, metricNames } = useMemo(() => {
    const names = Array.from(new Set(metrics.map((m) => m.metricName))).sort();
    const byWeek = new Map<string, Record<string, number | string>>();
    for (const m of metrics) {
      const row = byWeek.get(m.weekStart) ?? { weekStart: m.weekStart };
      row[m.metricName] = m.value;
      byWeek.set(m.weekStart, row);
    }
    const sortedRows = Array.from(byWeek.values()).sort((a, b) =>
      (a.weekStart as string).localeCompare(b.weekStart as string),
    );
    return { rows: sortedRows, metricNames: names };
  }, [metrics]);

  if (metricNames.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        <TrendingUp size={20} className="text-slate-400" />
        No metrics recorded yet.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e1e0d9" vertical={false} className="dark:opacity-20" />
          <XAxis
            dataKey="weekStart"
            tickFormatter={formatWeekLabel}
            tick={{ fill: "#898781", fontSize: 12 }}
            axisLine={{ stroke: "#c3c2b7" }}
            tickLine={false}
          />
          <YAxis tick={{ fill: "#898781", fontSize: 12 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            labelFormatter={(v) => `Week of ${formatWeekLabel(v as string)}`}
            contentStyle={{ borderRadius: 8, fontSize: 13, border: "1px solid #e1e0d9" }}
          />
          {metricNames.length > 1 && <Legend wrapperStyle={{ fontSize: 13 }} />}
          {metricNames.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              name={name}
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
