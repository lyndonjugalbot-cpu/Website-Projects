import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNZD, formatNZDCompact } from "../../utils/currency";
import type { ForecastPoint } from "../../utils/forecast";

interface ForecastChartProps {
  data: ForecastPoint[];
  goesNegative: boolean;
}

export function ForecastChart({ data, goesNegative }: ForecastChartProps) {
  const lineColor = goesNegative ? "#d03b3b" : "#2a78d6";

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.22} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
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
            formatter={(value) => [formatNZD(Number(value)), "Projected balance"]}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid rgb(226 232 240)",
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke={lineColor}
            strokeWidth={2}
            fill="url(#forecastFill)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: "#fcfcfb" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
