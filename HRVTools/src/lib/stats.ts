// The stats an agent can plot. `name` is what gets stored in `metrics.metricName`.
// `aggregation` decides how weekly values roll up into a month: counts are
// summed, percentages are averaged.
export type Aggregation = "sum" | "average";

export interface StatDefinition {
  name: string;
  label: string;
  aggregation: Aggregation;
  format: (value: number) => string;
}

export const STAT_DEFINITIONS: StatDefinition[] = [
  {
    name: "Number of appts",
    label: "Appts",
    aggregation: "sum",
    format: (v) => String(Math.round(v)),
  },
  {
    name: "Number of calls",
    label: "Calls",
    aggregation: "sum",
    format: (v) => String(Math.round(v)),
  },
  {
    name: "Presentability %",
    label: "Presentability %",
    aggregation: "average",
    format: (v) => `${v.toFixed(1)}%`,
  },
];

export const STAT_NAMES = STAT_DEFINITIONS.map((s) => s.name);

// Falls back to an "average" definition for any legacy / custom metric name.
export function statDefinition(name: string): StatDefinition {
  return (
    STAT_DEFINITIONS.find((s) => s.name === name) ?? {
      name,
      label: name,
      aggregation: "average",
      format: (v) => String(v),
    }
  );
}
