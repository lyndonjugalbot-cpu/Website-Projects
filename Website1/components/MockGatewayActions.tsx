"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MockGatewayActions({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState<"success" | "failed" | null>(null);

  async function confirm(outcome: "success" | "failed") {
    setIsSubmitting(outcome);
    try {
      await fetch("/api/payments/mock-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, outcome }),
      });
    } finally {
      router.push(`/checkout/${orderId}/return`);
    }
  }

  return (
    <div className="mt-8 flex flex-col gap-3">
      <button
        type="button"
        onClick={() => confirm("success")}
        disabled={isSubmitting !== null}
        className="w-full rounded-full bg-emerald-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting === "success" ? "Confirming…" : "Simulate successful payment"}
      </button>
      <button
        type="button"
        onClick={() => confirm("failed")}
        disabled={isSubmitting !== null}
        className="w-full rounded-full border border-neutral-300 px-6 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting === "failed" ? "Confirming…" : "Simulate declined payment"}
      </button>
    </div>
  );
}
