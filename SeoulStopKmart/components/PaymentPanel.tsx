"use client";

import { useState } from "react";
import type { PaymentMethodType } from "@/lib/types";
import { PAYMENT_METHOD_LABELS } from "@/lib/types";

const METHODS: { value: PaymentMethodType; label: string; hint?: string }[] = [
  { value: "gcash", label: PAYMENT_METHOD_LABELS.gcash },
  { value: "paymaya", label: PAYMENT_METHOD_LABELS.paymaya },
  { value: "card", label: PAYMENT_METHOD_LABELS.card },
  { value: "cod", label: PAYMENT_METHOD_LABELS.cod, hint: "Pay when your order arrives" },
  { value: "bank_transfer", label: PAYMENT_METHOD_LABELS.bank_transfer, hint: "Manual verification" },
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

  const isOffline = method === "cod" || method === "bank_transfer";

  return (
    <div className="rounded-2xl border border-neutral-200 p-5">
      <h2 className="font-medium text-neutral-900">Pay with</h2>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {METHODS.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMethod(m.value)}
            className={`flex flex-col items-center gap-0.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
              method === m.value
                ? "border-brand-red bg-brand-red text-white"
                : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
            }`}
          >
            <span>{m.label}</span>
            {m.hint && (
              <span className={`text-[11px] font-normal ${method === m.value ? "text-white/80" : "text-neutral-400"}`}>
                {m.hint}
              </span>
            )}
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

      {method === "cod" && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Pay in cash to the rider when your order is delivered. Please have the exact amount ready.
        </p>
      )}
      {method === "bank_transfer" && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Bank account details will be shown after you confirm — your order will be marked &ldquo;pending
          verification&rdquo; until our team confirms your transfer.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handlePay}
        disabled={isSubmitting || !canSubmit}
        className="mt-5 w-full rounded-full bg-brand-red px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:bg-neutral-300"
      >
        {isSubmitting
          ? "Processing…"
          : isOffline
            ? `Place order — ${METHODS.find((m) => m.value === method)?.label}`
            : `Pay with ${METHODS.find((m) => m.value === method)?.label}`}
      </button>
    </div>
  );
}
