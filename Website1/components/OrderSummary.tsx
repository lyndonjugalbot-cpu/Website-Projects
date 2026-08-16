import { formatCentavosAsPHP } from "@/lib/money";

export type OrderSummaryLine = {
  key: string;
  name: string;
  quantity: number;
  priceCentavos: number;
};

export function OrderSummary({
  lines,
  totalCentavos,
}: {
  lines: OrderSummaryLine[];
  totalCentavos: number;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 p-5">
      <h2 className="font-medium text-neutral-900">Order summary</h2>
      <ul className="mt-4 flex flex-col gap-3">
        {lines.map((line) => (
          <li key={line.key} className="flex justify-between text-sm">
            <span className="text-neutral-600">
              {line.name} <span className="text-neutral-400">&times;{line.quantity}</span>
            </span>
            <span className="font-medium text-neutral-900">
              {formatCentavosAsPHP(line.priceCentavos * line.quantity)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-between border-t border-neutral-200 pt-4 text-base">
        <span className="font-medium text-neutral-900">Total</span>
        <span className="font-semibold text-neutral-900">{formatCentavosAsPHP(totalCentavos)}</span>
      </div>
    </div>
  );
}
