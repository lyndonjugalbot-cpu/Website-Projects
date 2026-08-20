"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PayoutStatusBadge } from "@/components/shared/badges";
import { formatDate, formatNZD } from "@/lib/utils";
import type { PayoutStatus } from "@prisma/client";

type Payout = {
  id: string;
  amountCents: number;
  status: PayoutStatus;
  scheduledFor: string | null;
  paidAt: string | null;
  failureReason: string | null;
  seller: { username: string; fullName: string };
};

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = React.useState<Payout[]>([]);
  const [status, setStatus] = React.useState("ELIGIBLE");
  const [loading, setLoading] = React.useState(true);
  const [releasing, setReleasing] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/payouts?status=${status}`)
      .then((res) => res.json())
      .then((data) => setPayouts(data.payouts ?? []))
      .finally(() => setLoading(false));
  }, [status]);

  React.useEffect(() => load(), [load]);

  async function release(id: string) {
    setReleasing(id);
    try {
      const res = await fetch(`/api/admin/payouts/${id}/release`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not release payout.");
        return;
      }
      toast.success("Payout released.");
      load();
    } finally {
      setReleasing(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-semibold">Payouts</h2>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["ELIGIBLE", "NOT_ELIGIBLE", "PENDING", "PAID", "ON_HOLD", "FAILED", "REVERSED"] as const).map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-2">Loading…</p>
      ) : payouts.length === 0 ? (
        <p className="text-sm text-muted-2">No payouts in this status.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {payouts.map((p) => (
            <div key={p.id} className="card-luxury p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{formatNZD(p.amountCents)} — @{p.seller.username}</p>
                <p className="text-xs text-muted-2">
                  {p.paidAt
                    ? `Paid ${formatDate(p.paidAt)}`
                    : p.scheduledFor
                      ? `Eligible from ${formatDate(p.scheduledFor)}`
                      : ""}
                </p>
                {p.failureReason && <p className="text-xs text-danger mt-0.5">{p.failureReason}</p>}
              </div>
              <div className="flex items-center gap-2">
                <PayoutStatusBadge status={p.status} />
                {(p.status === "ELIGIBLE" || p.status === "FAILED") && (
                  <Button size="sm" onClick={() => release(p.id)} disabled={releasing === p.id}>
                    {releasing === p.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Release now
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
