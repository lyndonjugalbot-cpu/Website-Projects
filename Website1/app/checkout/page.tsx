"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { OrderSummary } from "@/components/OrderSummary";
import { formatCentavosAsPHP } from "@/lib/money";
import { DELIVERY_FEE_CENTAVOS } from "@/lib/store-config";

type FormState = {
  name: string;
  email: string;
  phone: string;
  addressLine: string;
  barangay: string;
  city: string;
  province: string;
  postalCode: string;
  deliveryNotes: string;
};

const INITIAL_FORM: FormState = {
  name: "",
  email: "",
  phone: "",
  addressLine: "",
  barangay: "",
  city: "Cebu City",
  province: "Cebu",
  postalCode: "",
  deliveryNotes: "",
};

export default function CheckoutPage() {
  const { items, subtotalCentavos, isLoaded, clearCart } = useCart();
  const router = useRouter();

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
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

  const total = subtotalCentavos + DELIVERY_FEE_CENTAVOS;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/cart" className="text-sm text-neutral-500 hover:text-neutral-800">
        &larr; Back to cart
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">Checkout</h1>

      <div className="mt-8 grid grid-cols-1 gap-10 md:grid-cols-5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 md:col-span-3">
          <h2 className="font-medium text-neutral-900">Contact details</h2>

          <Field label="Full name" required>
            <input
              type="text"
              required
              autoComplete="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Mobile number" required>
              <input
                type="tel"
                required
                autoComplete="tel"
                placeholder="09xx xxx xxxx"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Email" required>
              <input
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input"
              />
            </Field>
          </div>

          <h2 className="mt-2 font-medium text-neutral-900">Delivery address</h2>

          <Field label="House/unit no. and street" required>
            <input
              type="text"
              required
              autoComplete="address-line1"
              placeholder="e.g. Blk 3 Lot 12, Mabolo St."
              value={form.addressLine}
              onChange={(e) => setForm({ ...form, addressLine: e.target.value })}
              className="input"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Barangay" required>
              <input
                type="text"
                required
                value={form.barangay}
                onChange={(e) => setForm({ ...form, barangay: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="City / Municipality" required>
              <input
                type="text"
                required
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="input"
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Province" required>
              <input
                type="text"
                required
                value={form.province}
                onChange={(e) => setForm({ ...form, province: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Postal code">
              <input
                type="text"
                autoComplete="postal-code"
                value={form.postalCode}
                onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                className="input"
              />
            </Field>
          </div>
          <Field label="Delivery notes (optional)">
            <textarea
              rows={2}
              placeholder="Landmark, gate code, preferred delivery time, etc."
              value={form.deliveryNotes}
              onChange={(e) => setForm({ ...form, deliveryNotes: e.target.value })}
              className="input resize-none"
            />
          </Field>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 inline-flex items-center justify-center rounded-full bg-brand-red px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:bg-neutral-300"
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
            subtotalCentavos={subtotalCentavos}
            deliveryFeeCentavos={DELIVERY_FEE_CENTAVOS}
            totalCentavos={total}
          />
          <p className="mt-3 text-xs text-neutral-400">
            Flat delivery fee of {formatCentavosAsPHP(DELIVERY_FEE_CENTAVOS)} for Cebu addresses.
          </p>
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
