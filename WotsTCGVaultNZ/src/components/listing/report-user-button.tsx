"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Flag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const REASONS = [
  { value: "FRAUD", label: "Fraudulent behaviour" },
  { value: "HARASSMENT", label: "Harassment or abuse" },
  { value: "SPAM", label: "Spam" },
  { value: "PAYMENT_BYPASS_ATTEMPT", label: "Asking to pay off-platform" },
  { value: "OTHER", label: "Other" },
];

export function ReportUserButton({ userId }: { userId: string }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [details, setDetails] = React.useState("");
  const [sending, setSending] = React.useState(false);

  if (session?.user.id === userId) return null;

  async function submit() {
    if (!session) {
      router.push("/login");
      return;
    }
    if (!reason || details.trim().length < 10) return;
    setSending(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportedUserId: userId, reason, details }),
      });
      if (!res.ok) {
        toast.error("Could not submit report.");
        return;
      }
      toast.success("Thanks — our team will review this account.");
      setOpen(false);
      setDetails("");
      setReason("");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => (session ? setOpen(true) : router.push("/login"))}>
        <Flag className="h-4 w-4" /> Report user
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report this user</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div>
              <Label>Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Details</Label>
              <Textarea
                className="mt-1.5"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={4}
                placeholder="Describe what happened..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={submit}
              disabled={sending || !reason || details.trim().length < 10}
            >
              {sending && <Loader2 className="h-4 w-4 animate-spin" />} Submit report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
