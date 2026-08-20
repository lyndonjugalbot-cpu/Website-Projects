import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "../EmptyState";
import { formatNZD, formatNZDCompact } from "../../utils/currency";
import { LineChart as LineChartIcon } from "lucide-react";

interface TrendPoint {
  label: string;
  total: number;
}

interface SpendingTrendChartProps {
  data: TrendPoint[];
}

export function SpendingTrendChart({ data }: SpendingTrendChartProps) {
  const hasData = data.some((point) => point.total > 0);

  if (!hasData) {
    return (
      <EmptyState
        icon={LineChartIcon}
        title="No spending to chart yet"
        description="Add an expense within this period to see your spending trend."
      />
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2a78d6" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#2a78d6" stopOpacity={0} />
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
            minTickGap={16}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "currentColor" }}
            className="text-slate-400"
            width={56}
            tickFormatter={(value: number) => formatNZDCompact(value)}
          />
          <Tooltip
            formatter={(value) => [formatNZD(Number(value)), "Spent"]}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid rgb(226 232 240)",
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="#2a78d6"
            strokeWidth={2}
            fill="url(#trendFill)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: "#fcfcfb" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
