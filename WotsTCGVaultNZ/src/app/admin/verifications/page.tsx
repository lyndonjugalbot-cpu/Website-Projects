"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldX, RotateCcw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";
import { VERIFICATION_STATUS_LABELS } from "@/lib/constants";

type Submission = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "RESUBMISSION_REQUESTED";
  documentType: string;
  submittedAt: string;
  user: { username: string; fullName: string; email: string };
};

export default function AdminVerificationsPage() {
  const [submissions, setSubmissions] = React.useState<Submission[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState<string | null>(null);
  const [docUrls, setDocUrls] = React.useState<Record<string, { front?: string; back?: string }>>({});

  const load = React.useCallback(() => {
    setLoading(true);
    fetch("/api/admin/verifications")
      .then((res) => res.json())
      .then((data) => setSubmissions(data.submissions ?? []))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => load(), [load]);

  async function viewDocs(id: string) {
    const res = await fetch(`/api/admin/verifications/${id}`);
    const data = await res.json();
    setDocUrls((d) => ({ ...d, [id]: data.documentUrls ?? {} }));
  }

  async function decide(id: string, decision: "APPROVED" | "REJECTED" | "RESUBMISSION_REQUESTED") {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/verifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reviewerNotes: notes[id] }),
      });
      if (!res.ok) {
        toast.error("Could not update verification.");
        return;
      }
      toast.success("Verification updated.");
      load();
    } finally {
      setBusy(null);
    }
  }

  const pending = submissions.filter((s) => s.status === "PENDING");
  const others = submissions.filter((s) => s.status !== "PENDING");

  if (loading) return <p className="text-sm text-muted-2">Loading…</p>;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="font-semibold mb-4">Pending Review ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-2">No pending submissions.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map((s) => (
              <div key={s.id} className="card-luxury p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <p className="text-sm font-medium">@{s.user.username} — {s.user.fullName}</p>
                    <p className="text-xs text-muted-2">
                      {s.documentType.replace("_", " ")} · Submitted {formatDate(s.submittedAt)}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => viewDocs(s.id)}>
                    <ExternalLink className="h-3.5 w-3.5" /> View documents
                  </Button>
                </div>
                {docUrls[s.id] && (
                  <div className="flex gap-3 mb-3">
                    {docUrls[s.id].front && (
                      <a href={docUrls[s.id].front} target="_blank" rel="noopener noreferrer" className="text-xs text-gold hover:underline">
                        Front document ↗
                      </a>
                    )}
                    {docUrls[s.id].back && (
                      <a href={docUrls[s.id].back} target="_blank" rel="noopener noreferrer" className="text-xs text-gold hover:underline">
                        Back document ↗
                      </a>
                    )}
                    {!docUrls[s.id].front && <p className="text-xs text-muted-2">Storage not configured — no document to preview.</p>}
                  </div>
                )}
                <Textarea
                  placeholder="Reviewer notes (visible to seller on rejection/resubmission)"
                  className="mb-3"
                  rows={2}
                  value={notes[s.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => decide(s.id, "APPROVED")} disabled={busy === s.id}>
                    {busy === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />} Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => decide(s.id, "RESUBMISSION_REQUESTED")} disabled={busy === s.id}>
                    <RotateCcw className="h-3.5 w-3.5" /> Request resubmission
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => decide(s.id, "REJECTED")} disabled={busy === s.id}>
                    <ShieldX className="h-3.5 w-3.5" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-4">History</h2>
        <div className="flex flex-col gap-2">
          {others.map((s) => (
            <div key={s.id} className="card-luxury p-3 flex items-center justify-between">
              <span className="text-sm">@{s.user.username}</span>
              <Badge variant={s.status === "APPROVED" ? "success" : "danger"}>
                {VERIFICATION_STATUS_LABELS[s.status]}
              </Badge>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
