"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const POLL_INTERVAL_MS = 1500;
const MAX_ATTEMPTS = 16; // ~24s, generous for a webhook (or the mock flow) to land

/**
 * Landing page after a redirect-based payment (GCash/Maya/3DS/mock gateway).
 * Polls the order until the webhook (or the mock-confirm endpoint) has
 * updated its status, then forwards to the success/failed page.
 */
export default function CheckoutReturnPage({ params }: { params: { orderId: string } }) {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  const attempts = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/orders/${params.orderId}`, { cache: "no-store" });
        if (res.ok) {
          const order = await res.json();
          if (order.status === "PAID") {
            router.replace(`/checkout/success?orderId=${params.orderId}`);
            return;
          }
          if (order.status === "FAILED") {
            router.replace(`/checkout/failed?orderId=${params.orderId}`);
            return;
          }
        }
      } catch {
        // Network hiccup — just try again on the next tick.
      }

      attempts.current += 1;
      if (attempts.current >= MAX_ATTEMPTS) {
        if (!cancelled) setTimedOut(true);
        return;
      }
      if (!cancelled) setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [params.orderId, router]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center sm:px-6">
      {!timedOut ? (
        <>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
          <p className="mt-4 text-neutral-600">Confirming your payment&hellip;</p>
        </>
      ) : (
        <>
          <p className="text-neutral-900">This is taking longer than expected.</p>
          <p className="mt-1 text-sm text-neutral-500">
            Your payment may still be processing. Check back in a moment.
          </p>
          <Link href={`/checkout/${params.orderId}/pay`} className="mt-4 text-sm font-medium text-neutral-900 underline">
            Back to payment options
          </Link>
        </>
      )}
    </div>
  );
}
