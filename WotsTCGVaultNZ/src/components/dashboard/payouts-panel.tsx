"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PayoutStatusBadge, PayoutAccountStatusBadge } from "@/components/shared/badges";
import { formatDate, formatNZD } from "@/lib/utils";
import type { PayoutStatus, PayoutAccountStatus } from "@prisma/client";

type Payout = {
  id: string;
  amountCents: number;
  status: PayoutStatus;
  scheduledFor: string | null;
  paidAt: string | null;
  createdAt: string;
  failureReason: string | null;
};
type PayoutAccount = {
  status: PayoutAccountStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsCurrentlyDue: string[];
} | null;

export function PayoutsPanel() {
  const [payouts, setPayouts] = React.useState<Payout[]>([]);
  const [account, setAccount] = React.useState<PayoutAccount>(null);
  const [loading, setLoading] = React.useState(true);
  const [connecting, setConnecting] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch("/api/payouts")
      .then((res) => res.json())
      .then((data) => {
        setPayouts(data.payouts ?? []);
        setAccount(data.payoutAccount ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => load(), [load]);

  async function connectPayouts() {
    setConnecting(true);
    try {
      const res = await fetch("/api/stripe/connect/onboard", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not start payout setup.");
        return;
      }
      window.location.href = json.url;
    } finally {
      setConnecting(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-2">Loading payouts…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="card-luxury p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-medium flex items-center gap-2">
              Payout account
              {account && <PayoutAccountStatusBadge status={account.status} />}
            </p>
            <p className="text-xs text-muted-2 mt-1">
              {account?.status === "ENABLED"
                ? "Payouts are enabled via Stripe Connect."
                : account?.status === "RESTRICTED"
                  ? "Stripe needs more information from you before payouts can resume."
                  : account?.status === "DISABLED"
                    ? "Your payout account has been disabled by Stripe — contact support."
                    : "Complete Stripe onboarding to receive payouts."}
            </p>
          </div>
          <Button onClick={connectPayouts} disabled={connecting} variant={account?.status === "ENABLED" ? "outline" : "default"}>
            {connecting && <Loader2 className="h-4 w-4 animate-spin" />}
            {account?.status === "ENABLED" ? "Manage payout account" : "Set up payouts"}
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
        {account && account.requirementsCurrentlyDue.length > 0 && (
          <div className="flex items-start gap-2 text-xs text-warning border-t border-white/10 pt-3">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            Stripe is asking for: {account.requirementsCurrentlyDue.join(", ")}
          </div>
        )}
      </div>

      <div className="rounded-md border border-gold/20 bg-gold/5 p-3 text-xs text-muted leading-relaxed">
        Payouts are released after confirmed delivery and the buyer protection period, provided no
        dispute, refund, or account restriction is active. Payout timing may vary because of
        banking schedules, Stripe verification, reserves, and public holidays.
      </div>

      {payouts.length === 0 ? (
        <p className="text-sm text-muted-2">No payouts yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {payouts.map((p) => (
            <div key={p.id} className="card-luxury p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{formatNZD(p.amountCents)}</p>
                <p className="text-xs text-muted-2">
                  {p.paidAt
                    ? `Paid ${formatDate(p.paidAt)}`
                    : p.scheduledFor
                      ? `Expected from ${formatDate(p.scheduledFor)}`
                      : formatDate(p.createdAt)}
                </p>
                {p.failureReason && <p className="text-xs text-danger mt-0.5">{p.failureReason}</p>}
              </div>
              <PayoutStatusBadge status={p.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
