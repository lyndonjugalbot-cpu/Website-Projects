"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCentavosAsPHP } from "@/lib/money";

type RefundItem = {
  id: string;
  productName: string;
  unitPriceCentavos: number;
  quantity: number;
  refundedQuantity: number;
};

/**
 * Manager/Owner-only refund form on the POS receipt page. Pick how many of
 * each item came back; the amount shown mirrors refundPosSale() in
 * lib/pos.ts (the item's share of what was actually paid, after discounts
 * and points), which recomputes it on the server.
 */
export function RefundPanel({
  orderId,
  items,
  subtotalCentavos,
  totalCentavos,
  refundedCentavos,
  defaultMethod,
}: {
  orderId: string;
  items: RefundItem[];
  subtotalCentavos: number;
  totalCentavos: number;
  refundedCentavos: number;
  defaultMethod: "cash" | "gcash";
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<"cash" | "gcash">(defaultMethod);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const left = (i: RefundItem) => i.quantity - i.refundedQuantity;
  const selected = items.filter((i) => (qty[i.id] ?? 0) > 0);

  // Same cumulative maths as the server, so the preview matches to the centavo.
  const refundedValue = items.reduce((sum, i) => sum + i.unitPriceCentavos * (i.refundedQuantity + (qty[i.id] ?? 0)), 0);
  const isFull = items.every((i) => i.refundedQuantity + (qty[i.id] ?? 0) === i.quantity);
  const target = isFull ? totalCentavos : Math.round(totalCentavos * (subtotalCentavos > 0 ? refundedValue / subtotalCentavos : 1));
  const amountCentavos = selected.length > 0 ? target - refundedCentavos : 0;

  function selectAll() {
    setQty(Object.fromEntries(items.map((i) => [i.id, left(i)])));
  }

  async function handleRefund() {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/pos/${orderId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selected.map((i) => ({ orderItemId: i.id, quantity: qty[i.id] })),
          method,
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not process refund");
      setQty({});
      setReason("");
      setIsOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process refund");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-3 rounded-full border border-neutral-300 px-6 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 print:hidden"
      >
        Refund items
      </button>
    );
  }

  return (
    <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5 print:hidden">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-neutral-900">Refund items</h2>
        <button type="button" onClick={selectAll} className="text-sm font-medium text-brand-red hover:underline">
          Refund everything
        </button>
      </div>

      <div className="mt-3 flex flex-col divide-y divide-neutral-100 text-sm">
        {items.map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className={`truncate ${left(i) === 0 ? "text-neutral-400 line-through" : "text-neutral-800"}`}>{i.productName}</p>
              <p className="text-xs text-neutral-500">
                {formatCentavosAsPHP(i.unitPriceCentavos)} · bought {i.quantity}
                {i.refundedQuantity > 0 && `, ${i.refundedQuantity} already refunded`}
              </p>
            </div>
            <input
              type="number"
              min="0"
              max={left(i)}
              disabled={left(i) === 0}
              value={qty[i.id] ?? ""}
              placeholder="0"
              onChange={(e) => {
                const n = Math.max(0, Math.min(left(i), Number.parseInt(e.target.value, 10) || 0));
                setQty((prev) => ({ ...prev, [i.id]: n }));
              }}
              className="input w-20 py-1 text-right"
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 text-sm">
        <div>
          <p className="mb-1.5 font-medium text-neutral-700">Pay back from</p>
          <div className="grid grid-cols-2 gap-2">
            {(["cash", "gcash"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`rounded-xl border px-3 py-2 font-medium transition ${
                  method === m ? "border-brand-red bg-brand-red text-white" : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
                }`}
              >
                {m === "cash" ? "Cash drawer" : "GCash"}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="font-medium text-neutral-700">Reason (required)</span>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="input" placeholder="e.g. expired item, wrong flavour" />
        </label>
        <div className="flex justify-between border-t border-neutral-100 pt-3 text-base font-semibold text-neutral-900">
          <span>Refund amount</span>
          <span>{formatCentavosAsPHP(amountCentavos)}</span>
        </div>
        <p className="text-xs text-neutral-500">
          Refunded items go back into stock. The amount is the items&apos; share of what the customer paid, after discounts and points.
        </p>
        {error && <p className="text-red-600">{error}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleRefund}
            disabled={selected.length === 0 || !reason.trim() || isSubmitting}
            className="rounded-full bg-brand-red px-6 py-2.5 font-medium text-white transition hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {isSubmitting ? "Refunding…" : `Refund ${formatCentavosAsPHP(amountCentavos)}`}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-full border border-neutral-300 px-6 py-2.5 font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
