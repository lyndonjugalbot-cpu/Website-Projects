"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReceiptActions({ orderId, canVoid }: { orderId: string; canVoid: boolean }) {
  const router = useRouter();
  const [isVoiding, setIsVoiding] = useState(false);

  async function handleVoid() {
    const reason = prompt("Reason for voiding this sale (required):");
    if (!reason || !reason.trim()) return;
    setIsVoiding(true);
    try {
      const res = await fetch(`/api/admin/pos/${orderId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not void sale");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not void sale");
    } finally {
      setIsVoiding(false);
    }
  }

  return (
    <div className="flex gap-3 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-full bg-brand-red px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-red-dark"
      >
        Print receipt
      </button>
      {canVoid && (
        <button
          type="button"
          onClick={handleVoid}
          disabled={isVoiding}
          className="rounded-full border border-neutral-300 px-6 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
        >
          {isVoiding ? "Voiding…" : "Void sale"}
        </button>
      )}
    </div>
  );
}
