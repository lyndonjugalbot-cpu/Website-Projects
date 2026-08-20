"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, ShieldAlert } from "lucide-react";
import { cn, relativeTime } from "@/lib/utils";
import { toast } from "sonner";

type Participant = { id: string; username: string; displayName: string | null; fullName: string; avatarUrl: string | null };
type Conversation = {
  id: string;
  participantA: Participant;
  participantB: Participant;
  messages: { body: string; createdAt: string; senderId: string }[];
};
type Message = { id: string; body: string; createdAt: string; senderId: string; sender: { username: string; avatarUrl: string | null } };

export function MessagesView({ currentUserId }: { currentUserId: string }) {
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [reply, setReply] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/messages")
      .then((res) => res.json())
      .then((data) => {
        setConversations(data.conversations ?? []);
        if (data.conversations?.[0]) setActiveId(data.conversations[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    if (!activeId) return;
    fetch(`/api/messages/${activeId}`)
      .then((res) => res.json())
      .then((data) => setMessages(data.messages ?? []));
  }, [activeId]);

  function otherParticipant(c: Conversation) {
    return c.participantA.id === currentUserId ? c.participantB : c.participantA;
  }

  async function sendReply() {
    if (!activeId || !reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/messages/${activeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not send message.");
        return;
      }
      setMessages((m) => [...m, json.message]);
      setReply("");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-6xl px-4 py-10 text-muted">Loading messages…</div>;

  const active = conversations.find((c) => c.id === activeId);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-display font-bold mb-8">Messages</h1>
      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6 card-luxury overflow-hidden" style={{ minHeight: 500 }}>
        <div className="border-b md:border-b-0 md:border-r border-white/10">
          {conversations.length === 0 ? (
            <p className="p-4 text-sm text-muted-2">No conversations yet.</p>
          ) : (
            conversations.map((c) => {
              const other = otherParticipant(c);
              const last = c.messages[0];
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 text-left border-b border-white/5 hover:bg-white/5 transition-colors",
                    activeId === c.id && "bg-gold/5"
                  )}
                >
                  <Avatar>
                    <AvatarImage src={other.avatarUrl ?? undefined} alt="" />
                    <AvatarFallback>{(other.displayName ?? other.fullName).slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{other.displayName ?? other.fullName}</p>
                    {last && <p className="text-xs text-muted-2 truncate">{last.body}</p>}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="flex flex-col">
          {active ? (
            <>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 max-h-[420px]">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                      m.senderId === currentUserId
                        ? "self-end bg-gold text-black"
                        : "self-start bg-surface-2 text-foreground"
                    )}
                  >
                    {m.body}
                    <p
                      className={cn(
                        "text-[10px] mt-1",
                        m.senderId === currentUserId ? "text-black/60" : "text-muted-2"
                      )}
                    >
                      {relativeTime(m.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/10 p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-2 mb-2">
                  <ShieldAlert className="h-3 w-3" /> Keep payments on-platform — never share card details here.
                </div>
                <div className="flex gap-2">
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Write a message..."
                    rows={2}
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendReply();
                      }
                    }}
                  />
                  <Button onClick={sendReply} disabled={sending || !reply.trim()} size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-2 text-sm">
              Select a conversation
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
