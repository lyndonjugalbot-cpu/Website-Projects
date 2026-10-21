// Delivery-receipt statistics — a TypeScript port of the aggregation in the
// earlier SSKReceiptTracker app (sskreceipts/stats.py). Pure functions over
// plain rows, so it runs identically on the server and in the browser.
// Dates are "YYYY-MM-DD" strings in Asia/Manila; money is integer centavos.

export type ReceiptRow = { id: string; date: string; name: string; amountCentavos: number };

/** How many areas get their own bar before the tail folds into "Other". */
export const TOP_AREAS = 8;

export type Granularity = "day" | "week" | "month";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 86_400_000;

const toUtc = (d: string) => new Date(`${d}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: string, n: number) => iso(new Date(toUtc(d).getTime() + n * DAY_MS));

export function daysInclusive(start: string, end: string) {
  return Math.round((toUtc(end).getTime() - toUtc(start).getTime()) / DAY_MS) + 1;
}

/** Receipts sharing a name are one "area": "Meralco", "meralco " and "MERALCO" roll up together. */
export function areaKey(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function chooseGranularity(start: string, end: string): Granularity {
  const span = daysInclusive(start, end);
  if (span <= 31) return "day";
  if (span <= 122) return "week";
  return "month";
}

function bucketStart(date: string, g: Granularity) {
  if (g === "day") return date;
  if (g === "week") {
    const weekday = (toUtc(date).getUTCDay() + 6) % 7; // Monday = 0
    return addDays(date, -weekday);
  }
  return `${date.slice(0, 7)}-01`;
}

function nextBucket(date: string, g: Granularity) {
  if (g === "day") return addDays(date, 1);
  if (g === "week") return addDays(date, 7);
  const d = toUtc(date);
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)));
}

function bucketLabel(date: string, g: Granularity) {
  const d = toUtc(date);
  return g === "month"
    ? `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
    : `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export type AreaLine = {
  key: string;
  name: string;
  totalCentavos: number;
  count: number;
  sharePercent: number;
  isOther?: boolean;
};

export type SeriesPoint = { date: string; label: string; totalCentavos: number; count: number };

export type DeliverySummary = {
  totalCentavos: number;
  count: number;
  averageCentavos: number;
  dailyAverageCentavos: number;
  areaCount: number;
  topArea: AreaLine | null;
  largest: { name: string; amountCentavos: number; date: string } | null;
  previousTotalCentavos: number | null;
  /** null when there is no previous period (or it was zero) — never "+∞%". */
  changePercent: number | null;
  areas: AreaLine[];
  chartAreas: AreaLine[];
  granularity: Granularity;
  series: SeriesPoint[];
};

function rollupAreas(rows: ReceiptRow[], totalCentavos: number): AreaLine[] {
  const acc = new Map<string, AreaLine & { lastDate: string }>();
  for (const row of rows) {
    const key = areaKey(row.name);
    const entry = acc.get(key) ?? { key, name: row.name, totalCentavos: 0, count: 0, sharePercent: 0, lastDate: row.date };
    entry.totalCentavos += row.amountCentavos;
    entry.count += 1;
    // Display the spelling used on the most recent receipt.
    if (row.date >= entry.lastDate) {
      entry.lastDate = row.date;
      entry.name = row.name;
    }
    acc.set(key, entry);
  }
  return Array.from(acc.values())
    .sort((a, b) => b.totalCentavos - a.totalCentavos || a.name.localeCompare(b.name))
    .map(({ lastDate: _lastDate, ...a }) => {
      void _lastDate;
      return { ...a, sharePercent: totalCentavos ? Math.round((a.totalCentavos / totalCentavos) * 1000) / 10 : 0 };
    });
}

/** Keeps the top `limit` areas and collapses the rest into one "Other" bar. */
export function foldTail(areas: AreaLine[], limit = TOP_AREAS): AreaLine[] {
  if (areas.length <= limit) return areas;
  const tail = areas.slice(limit);
  return [
    ...areas.slice(0, limit),
    {
      key: "__other__",
      name: `Other (${tail.length} areas)`,
      totalCentavos: tail.reduce((s, a) => s + a.totalCentavos, 0),
      count: tail.reduce((s, a) => s + a.count, 0),
      sharePercent: Math.round(tail.reduce((s, a) => s + a.sharePercent, 0) * 10) / 10,
      isOther: true,
    },
  ];
}

/** Zero-filled series: an empty period is information, so it is drawn as 0 rather than skipped. */
function buildSeries(rows: ReceiptRow[], start: string, end: string) {
  const granularity = chooseGranularity(start, end);
  const totals = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = bucketStart(row.date, granularity);
    totals.set(key, (totals.get(key) ?? 0) + row.amountCentavos);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const points: SeriesPoint[] = [];
  const last = bucketStart(end, granularity);
  for (let cursor = bucketStart(start, granularity); cursor <= last; cursor = nextBucket(cursor, granularity)) {
    points.push({
      date: cursor,
      label: bucketLabel(cursor, granularity),
      totalCentavos: totals.get(cursor) ?? 0,
      count: counts.get(cursor) ?? 0,
    });
  }
  return { granularity, points };
}

export function summariseDeliveries(
  rows: ReceiptRow[],
  start: string,
  end: string,
  previousTotalCentavos: number | null
): DeliverySummary {
  const totalCentavos = rows.reduce((s, r) => s + r.amountCentavos, 0);
  const count = rows.length;
  const days = daysInclusive(start, end);
  const areas = rollupAreas(rows, totalCentavos);
  const largest = rows.length ? rows.reduce((a, b) => (b.amountCentavos > a.amountCentavos ? b : a)) : null;
  const { granularity, points } = buildSeries(rows, start, end);

  return {
    totalCentavos,
    count,
    averageCentavos: count ? Math.round(totalCentavos / count) : 0,
    dailyAverageCentavos: days ? Math.round(totalCentavos / days) : 0,
    areaCount: areas.length,
    topArea: areas[0] ?? null,
    largest: largest ? { name: largest.name, amountCentavos: largest.amountCentavos, date: largest.date } : null,
    previousTotalCentavos,
    changePercent: previousTotalCentavos
      ? Math.round(((totalCentavos - previousTotalCentavos) / previousTotalCentavos) * 1000) / 10
      : null,
    areas,
    chartAreas: foldTail(areas),
    granularity,
    series: points,
  };
}

/** The equally long window immediately before `start`. */
export function previousPeriod(start: string, end: string) {
  const span = daysInclusive(start, end);
  const prevEnd = addDays(start, -1);
  return { start: addDays(prevEnd, -(span - 1)), end: prevEnd };
}

export type RangePreset = "this-month" | "last-month" | "last-90" | "ytd" | "all";

/** Resolves a preset to concrete dates, given today's Manila date. */
export function presetRange(preset: RangePreset, today: string): { start: string; end: string } {
  const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  const monthStart = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, "0")}-01`;
  switch (preset) {
    case "this-month":
      return { start: monthStart(y, m), end: today };
    case "last-month": {
      const first = monthStart(y, m);
      return { start: monthStart(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1), end: addDays(first, -1) };
    }
    case "last-90":
      return { start: addDays(today, -89), end: today };
    case "ytd":
      return { start: `${y}-01-01`, end: today };
    case "all":
      return { start: "2000-01-01", end: today };
  }
}

export function receiptsToCsv(rows: ReceiptRow[]) {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [
    "Date,Receipt,Amount (PHP)",
    ...rows.map((r) => `${r.date},${esc(r.name)},${(r.amountCentavos / 100).toFixed(2)}`),
  ].join("\n");
}

/** Manila calendar date ("YYYY-MM-DD") of a stored instant. Receipts are stored at Manila midnight. */
export function manilaDateOf(d: Date) {
  return new Date(d.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

/** Shape sent to the browser for one stored receipt. */
export function toRow(r: {
  id: string;
  date: Date;
  receiptName: string;
  receiptNumber: string | null;
  amountCentavos: number;
  note: string | null;
  createdByName: string | null;
}) {
  return {
    id: r.id,
    date: manilaDateOf(r.date),
    name: r.receiptName,
    receiptNumber: r.receiptNumber,
    amountCentavos: r.amountCentavos,
    note: r.note,
    createdByName: r.createdByName,
  };
}
