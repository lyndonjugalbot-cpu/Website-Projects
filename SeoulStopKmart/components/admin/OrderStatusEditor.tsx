"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OrderStatus, PaymentStatus } from "@/lib/types";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/types";

const GATEWAY_METHODS = new Set(["gcash", "paymaya", "card"]);

export function OrderStatusEditor({
  orderId,
  orderStatus,
  paymentStatus,
  paymentMethod,
  internalNotes,
  lastUpdatedByName,
}: {
  orderId: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  internalNotes: string;
  lastUpdatedByName: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(orderStatus);
  const [payment, setPayment] = useState(paymentStatus);
  const [notes, setNotes] = useState(internalNotes);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isGatewayOrder = paymentMethod ? GATEWAY_METHODS.has(paymentMethod) : false;

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderStatus: status, paymentStatus: payment, internalNotes: notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save changes");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-neutral-200 bg-white p-5">
      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-neutral-400">Order status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)} className="input mt-1.5">
          {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-neutral-400">Payment status</label>
        <select
          value={payment}
          onChange={(e) => setPayment(e.target.value as PaymentStatus)}
          disabled={isGatewayOrder}
          className="input mt-1.5 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
        >
          {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        {isGatewayOrder && (
          <p className="mt-1.5 text-xs text-neutral-400">
            Set automatically once PayMongo confirms the payment — not staff-editable.
          </p>
        )}
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-neutral-400">Internal notes</label>
        <textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Only visible to staff — e.g. delivery attempts, special instructions."
          className="input mt-1.5 resize-none"
        />
        {lastUpdatedByName && <p className="mt-1 text-xs text-neutral-400">Last updated by {lastUpdatedByName}</p>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && !error && <p className="text-sm text-emerald-600">Saved.</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className="rounded-full bg-brand-red px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:bg-neutral-300"
      >
        {isSaving ? "Saving…" : "Save changes"}
      </button>
    </section>
  );
}
