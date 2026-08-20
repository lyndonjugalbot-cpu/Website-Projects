"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export function MessageSellerButton({
  sellerId,
  listingId,
  sellerName,
}: {
  sellerId: string;
  listingId: string;
  sellerName: string;
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [body, setBody] = React.useState("");
  const [sending, setSending] = React.useState(false);

  async function send() {
    if (!session) {
      router.push("/login");
      return;
    }
    if (!body.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: sellerId, listingId, body }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error ?? "Could not send message.");
        return;
      }
      toast.success("Message sent!");
      setOpen(false);
      setBody("");
      router.push("/messages");
    } finally {
      setSending(false);
    }
  }

  if (session && session.user.id === sellerId) return null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => (session ? setOpen(true) : router.push("/login"))}>
        <MessageCircle className="h-4 w-4" /> Message Seller
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message {sellerName}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Ask about condition, shipping, or bundle a deal..."
            rows={5}
          />
          <p className="text-xs text-muted-2 mt-2">
            For your safety, keep payments on-platform. Sharing external payment details to bypass
            checkout is against our marketplace rules.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={send} disabled={sending || !body.trim()}>
              {sending && <Loader2 className="h-4 w-4 animate-spin" />} Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
