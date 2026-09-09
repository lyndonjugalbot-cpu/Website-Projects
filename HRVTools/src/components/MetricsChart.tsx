import { TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
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
import { statDefinition } from "../lib/stats";
import { formatMonthLabel, formatWeekLabel, monthKeyOf } from "../lib/weeks";
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

type Period = "weekly" | "monthly";

export function MetricsChart({ metrics }: { metrics: MetricDoc[] }) {
  const [period, setPeriod] = useState<Period>("weekly");
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());

  const allMetricNames = useMemo(
    () => Array.from(new Set(metrics.map((m) => m.metricName))).sort(),
    [metrics],
  );

  const rows = useMemo(() => {
    // bucket key -> metricName -> running { total, count }
    const buckets = new Map<string, Map<string, { total: number; count: number }>>();
    for (const m of metrics) {
      const key = period === "weekly" ? m.weekStart : monthKeyOf(m.weekStart);
      let byMetric = buckets.get(key);
      if (!byMetric) {
        byMetric = new Map();
        buckets.set(key, byMetric);
      }
      const cell = byMetric.get(m.metricName) ?? { total: 0, count: 0 };
      cell.total += m.value;
      cell.count += 1;
      byMetric.set(m.metricName, cell);
    }

    return Array.from(buckets.keys())
      .sort()
      .map((key) => {
        const row: Record<string, number | string> = { bucket: key };
        for (const [name, cell] of buckets.get(key)!) {
          row[name] =
            statDefinition(name).aggregation === "sum"
              ? cell.total
              : cell.count
                ? cell.total / cell.count
                : 0;
        }
        return row;
      });
  }, [metrics, period]);

  const visibleNames = allMetricNames.filter((n) => !hidden.has(n));
  const labelFor = period === "weekly" ? formatWeekLabel : formatMonthLabel;

  if (allMetricNames.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        <TrendingUp size={20} className="text-slate-400" />
        No stats recorded yet.
      </div>
    );
  }

  function toggle(name: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-800">
          {(["weekly", "monthly"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition ${
                period === p
                  ? "bg-brand-600 text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {allMetricNames.map((name) => {
            const on = !hidden.has(name);
            const color = SERIES_COLORS[allMetricNames.indexOf(name) % SERIES_COLORS.length];
            return (
              <button
                key={name}
                onClick={() => toggle(name)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  on
                    ? "border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200"
                    : "border-slate-200 text-slate-400 dark:border-slate-800 dark:text-slate-600"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: on ? color : "transparent",
                    border: on ? undefined : `1px solid ${color}`,
                  }}
                />
                {statDefinition(name).label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        {visibleNames.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            Select a stat above to plot it.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e1e0d9"
                vertical={false}
                className="dark:opacity-20"
              />
              <XAxis
                dataKey="bucket"
                tickFormatter={labelFor}
                tick={{ fill: "#898781", fontSize: 12 }}
                axisLine={{ stroke: "#c3c2b7" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#898781", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                labelFormatter={(v) =>
                  period === "weekly"
                    ? `Week of ${formatWeekLabel(v as string)}`
                    : formatMonthLabel(v as string)
                }
                contentStyle={{ borderRadius: 8, fontSize: 13, border: "1px solid #e1e0d9" }}
              />
              {visibleNames.length > 1 && <Legend wrapperStyle={{ fontSize: 13 }} />}
              {visibleNames.map((name) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  name={statDefinition(name).label}
                  stroke={SERIES_COLORS[allMetricNames.indexOf(name) % SERIES_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
