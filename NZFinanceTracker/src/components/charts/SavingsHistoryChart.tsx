import { PiggyBank } from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNZD, formatNZDCompact } from "../../utils/currency";
import type { SavingsTimelinePoint } from "../../utils/savings";
import { EmptyState } from "../EmptyState";

interface SavingsHistoryChartProps {
  data: SavingsTimelinePoint[];
  showTarget: boolean;
}

const BALANCE_COLOR = "#2a78d6";
const TARGET_COLOR = "#0ca30c";

export function SavingsHistoryChart({ data, showTarget }: SavingsHistoryChartProps) {
  if (data.length === 0) {
    return (
      <EmptyState
        icon={PiggyBank}
        title="No savings history yet"
        description="Add money to savings or set a weekly savings goal to start building your history."
      />
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="savingsBalanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BALANCE_COLOR} stopOpacity={0.22} />
              <stop offset="100%" stopColor={BALANCE_COLOR} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeDasharray="0" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "currentColor" }}
            className="text-slate-400"
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "currentColor" }}
            className="text-slate-400"
            width={56}
            tickFormatter={(value: number) => formatNZDCompact(value)}
          />
          <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
          <Tooltip
            formatter={(value, name) => [formatNZD(Number(value)), name as string]}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid rgb(226 232 240)",
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="balance"
            name="Set aside"
            stroke={BALANCE_COLOR}
            strokeWidth={2}
            fill="url(#savingsBalanceFill)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: "#fcfcfb" }}
          />
          {showTarget && (
            <Line
              type="monotone"
              dataKey="target"
              name="Target (no overspend)"
              stroke={TARGET_COLOR}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "#fcfcfb" }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
