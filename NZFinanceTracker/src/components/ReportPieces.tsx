import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function ReportStat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon?: LucideIcon;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      <p className="mt-1 truncate text-lg font-bold text-slate-900 dark:text-slate-100">{value}</p>
      {sub && <p className="truncate text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
      {children}
    </div>
  );
}
