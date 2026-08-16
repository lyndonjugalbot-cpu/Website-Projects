"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { OrderSummary } from "@/components/OrderSummary";

type FormState = { name: string; email: string; phone: string; address: string };

export default function CheckoutPage() {
  const { items, subtotalCentavos, isLoaded, clearCart } = useCart();
  const router = useRouter();

  const [form, setForm] = useState<FormState>({ name: "", email: "", phone: "", address: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Placing an order clears the cart, which would otherwise make the
  // empty-cart redirect below fire and race with the navigation to /pay.
  const hasPlacedOrderRef = useRef(false);

  useEffect(() => {
    if (isLoaded && items.length === 0 && !hasPlacedOrderRef.current) {
      router.replace("/cart");
    }
  }, [isLoaded, items.length, router]);

  if (!isLoaded || items.length === 0) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-neutral-400 sm:px-6">Loading&hellip;</div>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: form,
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not place order");

      hasPlacedOrderRef.current = true;
      clearCart();
      router.push(`/checkout/${data.orderId}/pay`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/cart" className="text-sm text-neutral-500 hover:text-neutral-800">
        &larr; Back to cart
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">Checkout</h1>

      <div className="mt-8 grid grid-cols-1 gap-10 md:grid-cols-5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 md:col-span-3">
          <h2 className="font-medium text-neutral-900">Delivery details</h2>

          <Field label="Full name" required>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Email" required>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Phone number" required>
            <input
              type="tel"
              required
              placeholder="09xx xxx xxxx"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Delivery address" required>
            <textarea
              required
              rows={3}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="input resize-none"
            />
          </Field>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 inline-flex items-center justify-center rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {isSubmitting ? "Placing order…" : "Continue to payment"}
          </button>
        </form>

        <div className="md:col-span-2">
          <OrderSummary
            lines={items.map((i) => ({
              key: i.productId,
              name: i.name,
              quantity: i.quantity,
              priceCentavos: i.priceCentavos,
            }))}
            totalCentavos={subtotalCentavos}
          />
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-neutral-700">
        {label}
        {required && <span className="text-neutral-400"> *</span>}
      </span>
      {children}
    </label>
  );
}
