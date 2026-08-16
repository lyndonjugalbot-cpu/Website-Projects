"use client";

import { useState } from "react";
import type { PaymentMethodType } from "@/lib/types";

const METHODS: { value: PaymentMethodType; label: string }[] = [
  { value: "gcash", label: "GCash" },
  { value: "paymaya", label: "Maya" },
  { value: "card", label: "Card" },
];

export function PaymentPanel({ orderId }: { orderId: string }) {
  const [method, setMethod] = useState<PaymentMethodType>("gcash");
  const [card, setCard] = useState({ cardNumber: "", expMonth: "", expYear: "", cvc: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/payments/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          method,
          card:
            method === "card"
              ? {
                  cardNumber: card.cardNumber.replace(/\s+/g, ""),
                  expMonth: Number(card.expMonth),
                  expYear: Number(card.expYear.length === 2 ? `20${card.expYear}` : card.expYear),
                  cvc: card.cvc,
                }
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Payment failed");

      if (data.redirectUrl) {
        window.location.assign(data.redirectUrl);
        return;
      }
      // Already succeeded with nowhere further to redirect (e.g. re-submitted a paid order).
      window.location.assign(`/checkout/${orderId}/return`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setIsSubmitting(false);
    }
  }

  const canSubmit =
    method !== "card" ||
    (card.cardNumber.replace(/\s+/g, "").length >= 12 && card.expMonth && card.expYear && card.cvc.length >= 3);

  return (
    <div className="rounded-2xl border border-neutral-200 p-5">
      <h2 className="font-medium text-neutral-900">Pay with</h2>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {METHODS.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMethod(m.value)}
            className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
              method === m.value
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {method === "card" && (
        <div className="mt-4 flex flex-col gap-3">
          <input
            type="text"
            inputMode="numeric"
            placeholder="Card number"
            value={card.cardNumber}
            onChange={(e) => setCard({ ...card, cardNumber: e.target.value })}
            className="input"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              inputMode="numeric"
              placeholder="MM"
              maxLength={2}
              value={card.expMonth}
              onChange={(e) => setCard({ ...card, expMonth: e.target.value })}
              className="input"
            />
            <input
              type="text"
              inputMode="numeric"
              placeholder="YY"
              maxLength={4}
              value={card.expYear}
              onChange={(e) => setCard({ ...card, expYear: e.target.value })}
              className="input"
            />
            <input
              type="text"
              inputMode="numeric"
              placeholder="CVC"
              maxLength={4}
              value={card.cvc}
              onChange={(e) => setCard({ ...card, cvc: e.target.value })}
              className="input"
            />
          </div>
          <p className="text-xs text-neutral-400">
            Use any PayMongo test card, e.g. 4343 4343 4343 4345, any future expiry, any CVC.
          </p>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handlePay}
        disabled={isSubmitting || !canSubmit}
        className="mt-5 w-full rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
      >
        {isSubmitting ? "Processing…" : `Pay with ${METHODS.find((m) => m.value === method)?.label}`}
      </button>
    </div>
  );
}
