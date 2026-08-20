"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Truck, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { formatNZD } from "@/lib/utils";

type ShippingOption = { id: string; name: string; priceCents: number; hasInsurance: boolean };
type Breakdown = { subtotalCents: number; shippingCents: number; buyerFeeCents: number; totalCents: number };

export function BuyBox({
  listingId,
  priceCents,
  quantity,
  offersPickup,
  shippingOptions,
}: {
  listingId: string;
  priceCents: number;
  quantity: number;
  offersPickup: boolean;
  shippingOptions: ShippingOption[];
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const [selectedShipping, setSelectedShipping] = React.useState(shippingOptions[0]?.id ?? "pickup");
  const [submitting, setSubmitting] = React.useState(false);
  const [breakdown, setBreakdown] = React.useState<Breakdown | null>(null);

  React.useEffect(() => {
    if (selectedShipping === "pickup" || !selectedShipping) {
      setBreakdown({ subtotalCents: priceCents, shippingCents: 0, buyerFeeCents: 0, totalCents: priceCents });
      return;
    }
    const controller = new AbortController();
    fetch(`/api/pricing/preview?listingId=${listingId}&shippingOptionId=${selectedShipping}&quantity=1`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (!controller.signal.aborted && !data.error) setBreakdown(data);
      })
      .catch(() => null);
    return () => controller.abort();
  }, [listingId, selectedShipping, priceCents]);

  async function buyNow() {
    if (!session) {
      router.push("/login");
      return;
    }
    if (selectedShipping === "pickup") {
      toast.info("Local pickup orders are coordinated via message — contact the seller to arrange.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          quantity: 1,
          shippingOptionId: selectedShipping,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not start checkout.");
        return;
      }
      if (json.url) window.location.href = json.url;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card-luxury p-5">
      <p className="text-3xl font-display font-semibold text-gold-light">{formatNZD(priceCents)}</p>
      <p className="text-xs text-muted-2 mt-1">
        {quantity > 0 ? `${quantity} in stock` : "Out of stock"}
      </p>

      <div className="mt-5">
        <Label className="text-xs uppercase tracking-wide text-muted-2">Delivery method</Label>
        <RadioGroup value={selectedShipping} onValueChange={setSelectedShipping} className="mt-2">
          {shippingOptions.map((opt) => (
            <label
              key={opt.id}
              htmlFor={opt.id}
              className="flex items-center justify-between gap-2 rounded-md border border-white/10 px-3 py-2.5 cursor-pointer hover:border-gold/30 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm">
                <RadioGroupItem value={opt.id} id={opt.id} />
                <Truck className="h-3.5 w-3.5 text-muted" /> {opt.name}
                {opt.hasInsurance && <ShieldCheck className="h-3.5 w-3.5 text-gold" />}
              </span>
              <span className="text-sm text-muted">{formatNZD(opt.priceCents)}</span>
            </label>
          ))}
          {offersPickup && (
            <label
              htmlFor="pickup"
              className="flex items-center justify-between gap-2 rounded-md border border-white/10 px-3 py-2.5 cursor-pointer hover:border-gold/30 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="pickup" id="pickup" />
                <MapPin className="h-3.5 w-3.5 text-muted" /> Local pickup
              </span>
              <span className="text-sm text-muted">Free</span>
            </label>
          )}
        </RadioGroup>
      </div>

      {breakdown && (
        <div className="mt-4 flex flex-col gap-1.5 text-sm border-t border-white/10 pt-4">
          <div className="flex items-center justify-between text-muted">
            <span>Item price</span>
            <span>{formatNZD(breakdown.subtotalCents)}</span>
          </div>
          <div className="flex items-center justify-between text-muted">
            <span>Shipping</span>
            <span>{formatNZD(breakdown.shippingCents)}</span>
          </div>
          {breakdown.buyerFeeCents > 0 && (
            <div className="flex items-center justify-between text-muted">
              <span>Payment processing fee</span>
              <span>{formatNZD(breakdown.buyerFeeCents)}</span>
            </div>
          )}
          <div className="flex items-center justify-between font-semibold text-base pt-1.5 border-t border-white/10">
            <span>Total</span>
            <span>{formatNZD(breakdown.totalCents)}</span>
          </div>
        </div>
      )}

      <Button className="w-full mt-4" size="lg" disabled={quantity <= 0 || submitting} onClick={buyNow}>
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {quantity <= 0 ? "Sold Out" : "Buy Now"}
      </Button>

      <p className="text-[11px] text-muted-2 mt-3 text-center leading-relaxed">
        Payments are processed by Stripe. Wots TCG Vault NZ operates a platform-managed payment and
        payout process — seller payout release generally follows confirmed delivery and the buyer
        protection period.
      </p>
    </div>
  );
}
