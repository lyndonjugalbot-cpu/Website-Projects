import type { Metadata } from "next";
import { PointsChecker } from "@/components/PointsChecker";
import {
  POINTS_EARN_PESOS_PER_POINT,
  POINTS_MIN_REDEEM,
  POINT_VALUE_CENTAVOS,
  STORE_NAME,
} from "@/lib/store-config";
import { formatCentavosAsPHP } from "@/lib/money";

export const metadata: Metadata = {
  title: "Check your points",
  description: `Check your ${STORE_NAME} rewards points with your mobile number and PIN.`,
};

export default function PointsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand-red">Rewards</p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-brand-black text-balance sm:text-5xl">
            Check your points
          </h1>
          <p className="mt-5 max-w-md leading-relaxed text-brand-ink/70">
            Shop in store, give the cashier your mobile number, and earn points on every purchase. Use them as a discount on
            your next visit.
          </p>

          <dl className="mt-10 grid gap-px overflow-hidden rounded-3xl bg-brand-black/10 text-sm sm:grid-cols-3 lg:grid-cols-1">
            <div className="bg-brand-cream p-5">
              <dt className="text-xs uppercase tracking-widest text-brand-ink/50">Earn</dt>
              <dd className="mt-1 font-display text-xl font-semibold text-brand-black">
                1 point per {formatCentavosAsPHP(POINTS_EARN_PESOS_PER_POINT * 100).replace(".00", "")} spent
              </dd>
            </div>
            <div className="bg-brand-cream p-5">
              <dt className="text-xs uppercase tracking-widest text-brand-ink/50">Spend</dt>
              <dd className="mt-1 font-display text-xl font-semibold text-brand-black">
                1 point = {formatCentavosAsPHP(POINT_VALUE_CENTAVOS)} off
              </dd>
            </div>
            <div className="bg-brand-cream p-5">
              <dt className="text-xs uppercase tracking-widest text-brand-ink/50">Start using at</dt>
              <dd className="mt-1 font-display text-xl font-semibold text-brand-black">{POINTS_MIN_REDEEM} points</dd>
            </div>
          </dl>
          <p className="mt-6 text-sm text-brand-ink/60">
            Not a member yet? Ask the cashier to sign you up. It takes a few seconds, and you get a 4-digit PIN to check your points here.
          </p>
        </div>

        <PointsChecker />
      </div>
    </div>
  );
}
