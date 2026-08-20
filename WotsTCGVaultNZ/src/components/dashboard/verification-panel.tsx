"use client";

import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { VERIFICATION_STATUS_LABELS } from "@/lib/constants";

type Submission = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "RESUBMISSION_REQUESTED";
  documentType: string;
  reviewerNotes: string | null;
  submittedAt: string;
};

const STATUS_ICON = {
  PENDING: Clock,
  APPROVED: CheckCircle2,
  REJECTED: XCircle,
  RESUBMISSION_REQUESTED: ShieldAlert,
};

async function uploadDocument(file: File): Promise<string | null> {
  const presignRes = await fetch("/api/upload/identity-document", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: file.type, sizeBytes: file.size }),
  });
  const presign = await presignRes.json();
  if (!presignRes.ok) {
    toast.error(presign.error ?? "Document storage isn't configured yet.");
    return null;
  }
  await fetch(presign.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
  return presign.key as string;
}

export function VerificationPanel() {
  const [submissions, setSubmissions] = React.useState<Submission[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [documentType, setDocumentType] = React.useState("drivers_license");
  const [frontFile, setFrontFile] = React.useState<File | null>(null);
  const [backFile, setBackFile] = React.useState<File | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch("/api/verification")
      .then((res) => res.json())
      .then((data) => setSubmissions(data.submissions ?? []))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => load(), [load]);

  const latest = submissions[0];
  const canSubmit = !latest || latest.status === "REJECTED" || latest.status === "RESUBMISSION_REQUESTED";

  async function submit() {
    if (!frontFile) {
      toast.error("Upload the front of your ID document.");
      return;
    }
    setSubmitting(true);
    try {
      const frontKey = await uploadDocument(frontFile);
      if (!frontKey) return;
      const backKey = backFile ? await uploadDocument(backFile) : undefined;

      const res = await fetch("/api/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentType, documentFrontKey: frontKey, documentBackKey: backKey }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not submit verification.");
        return;
      }
      toast.success("ID submitted for review. This usually takes 1-2 business days.");
      setFrontFile(null);
      setBackFile(null);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-2">Loading verification status…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-md border border-gold/20 bg-gold/5 p-4 text-xs text-muted leading-relaxed">
        Your ID is stored encrypted and access is restricted to verification reviewers only. It is
        automatically scheduled for deletion once no longer required for compliance. See our
        Privacy Policy for details.{" "}
        <strong className="text-gold-light">
          Placeholder: obtain qualified NZ legal advice on Privacy Act 2020 and AML/CFT obligations
          before launching this verification flow in production.
        </strong>
      </div>

      {submissions.length > 0 && (
        <div className="flex flex-col gap-2">
          {submissions.map((s) => {
            const Icon = STATUS_ICON[s.status];
            return (
              <div key={s.id} className="card-luxury p-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 text-gold" />
                  <div>
                    <p className="text-sm">{s.documentType.replace("_", " ")}</p>
                    <p className="text-xs text-muted-2">Submitted {formatDate(s.submittedAt)}</p>
                    {s.reviewerNotes && <p className="text-xs text-warning mt-1">{s.reviewerNotes}</p>}
                  </div>
                </div>
                <Badge
                  variant={
                    s.status === "APPROVED" ? "success" : s.status === "REJECTED" ? "danger" : "warning"
                  }
                >
                  {VERIFICATION_STATUS_LABELS[s.status]}
                </Badge>
              </div>
            );
          })}
        </div>
      )}

      {canSubmit && (
        <div className="card-luxury p-5">
          <h3 className="font-semibold mb-4">Submit ID Verification</h3>
          <div className="flex flex-col gap-4">
            <div>
              <Label>Document type</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="drivers_license">NZ Driver Licence</SelectItem>
                  <SelectItem value="passport">Passport</SelectItem>
                  <SelectItem value="nz_id">NZ 18+ Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Front of document</Label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFrontFile(e.target.files?.[0] ?? null)}
                className="mt-1.5 text-sm text-muted"
              />
            </div>
            <div>
              <Label>Back of document (if applicable)</Label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setBackFile(e.target.files?.[0] ?? null)}
                className="mt-1.5 text-sm text-muted"
              />
            </div>
            <Button onClick={submit} disabled={submitting} className="self-start">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Submit for review
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
