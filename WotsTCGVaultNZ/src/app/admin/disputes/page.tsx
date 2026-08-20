"use client";

import * as React from "react";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DisputeStatusBadge } from "@/components/shared/badges";
import { formatDate, formatNZD } from "@/lib/utils";

type Dispute = {
  id: string;
  reason: string;
  description: string;
  status: "OPEN" | "SELLER_RESPONSE_REQUIRED" | "UNDER_REVIEW" | "WAITING_FOR_EVIDENCE" | "RESOLVED_BUYER" | "RESOLVED_SELLER" | "PARTIAL_REFUND" | "CLOSED";
  source: "BUYER" | "STRIPE_CHARGEBACK";
  sellerResponse: string | null;
  createdAt: string;
  evidenceDueBy: string | null;
  filedBy: { username: string };
  order: { id: string; totalCents: number; status: string };
  evidence: { id: string; url: string; note: string | null; uploadedBy: string }[];
};

const RESOLVED_STATUSES = new Set(["RESOLVED_BUYER", "RESOLVED_SELLER", "PARTIAL_REFUND", "CLOSED"]);

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = React.useState<Dispute[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refundAmounts, setRefundAmounts] = React.useState<Record<string, string>>({});
  const [notes, setNotes] = React.useState<Record<string, string>>({});

  const load = React.useCallback(() => {
    setLoading(true);
    fetch("/api/admin/disputes")
      .then((res) => res.json())
      .then((data) => setDisputes(data.disputes ?? []))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => load(), [load]);

  async function resolve(d: Dispute, outcome: "RESOLVED_BUYER" | "RESOLVED_SELLER" | "PARTIAL_REFUND" | "CLOSED") {
    const refundDollars = refundAmounts[d.id];
    const refundCents = refundDollars ? Math.round(Number(refundDollars) * 100) : undefined;

    const res = await fetch(`/api/admin/disputes/${d.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome, resolutionNotes: notes[d.id], refundCents }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Could not resolve dispute.");
      return;
    }
    toast.success("Dispute resolved.");
    load();
  }

  if (loading) return <p className="text-sm text-muted-2">Loading…</p>;
  if (disputes.length === 0) return <p className="text-sm text-muted-2">No disputes.</p>;

  return (
    <div className="flex flex-col gap-4">
      {disputes.map((d) => (
        <div key={d.id} className="card-luxury p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{d.reason.replace(/_/g, " ")}</Badge>
              {d.source === "STRIPE_CHARGEBACK" && <Badge variant="danger">Stripe chargeback</Badge>}
            </div>
            <DisputeStatusBadge status={d.status} />
          </div>
          <p className="text-sm text-muted mb-2">{d.description}</p>
          {d.sellerResponse && (
            <div className="text-sm bg-surface-2 rounded-md p-3 mb-2">
              <p className="text-xs text-muted-2 mb-1">Seller response:</p>
              {d.sellerResponse}
            </div>
          )}
          {d.evidence.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {d.evidence.map((e) => (
                <a
                  key={e.id}
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-gold hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Evidence
                </a>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-2 mb-3">
            Filed by @{d.filedBy.username} · Order #{d.order.id.slice(-8)} · {formatNZD(d.order.totalCents)} ·{" "}
            {formatDate(d.createdAt)}
            {d.evidenceDueBy && !RESOLVED_STATUSES.has(d.status) && (
              <> · Response due {formatDate(d.evidenceDueBy)}</>
            )}
          </p>

          {!RESOLVED_STATUSES.has(d.status) && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  placeholder={`Refund $ (max ${(d.order.totalCents / 100).toFixed(2)})`}
                  className="w-48"
                  value={refundAmounts[d.id] ?? ""}
                  onChange={(e) => setRefundAmounts((r) => ({ ...r, [d.id]: e.target.value }))}
                />
              </div>
              <Textarea
                placeholder="Resolution notes (shown to buyer & seller)"
                rows={2}
                value={notes[d.id] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [d.id]: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => resolve(d, "RESOLVED_BUYER")}>
                  Resolve for buyer (full refund)
                </Button>
                <Button size="sm" variant="outline" onClick={() => resolve(d, "PARTIAL_REFUND")}>
                  Partial refund
                </Button>
                <Button size="sm" variant="outline" onClick={() => resolve(d, "RESOLVED_SELLER")}>
                  Resolve for seller
                </Button>
                <Button size="sm" variant="ghost" onClick={() => resolve(d, "CLOSED")}>
                  Close (no action)
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
