"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Send, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ChatMessage = { role: "user" | "assistant"; content: string };

const GREETING: ChatMessage = {
  role: "assistant",
  content: "Hi! I can help with questions about buying, selling, fees, shipping, and disputes on Wots TCG Vault NZ. What do you need?",
};

export function ChatWidget() {
  const { status } = useSession();
  const [open, setOpen] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const conversationIdRef = React.useRef<string | undefined>(undefined);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open || hydrated || status !== "authenticated") return;
    setHydrated(true);
    fetch("/api/chat")
      .then((res) => res.json())
      .then((data) => {
        if (data.conversation?.messages?.length) {
          conversationIdRef.current = data.conversation.id;
          setMessages(
            data.conversation.messages.map((m: { role: string; content: string }) => ({
              role: m.role === "USER" ? "user" : "assistant",
              content: m.content,
            }))
          );
        }
      })
      .catch(() => {});
  }, [open, hydrated, status]);

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conversationIdRef.current, message: text }),
      });

      const convoId = res.headers.get("X-Conversation-Id");
      if (convoId) conversationIdRef.current = convoId;

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => null);
        toast.error(json?.error ?? "Something went wrong. Please try again.");
        setMessages((m) => m.slice(0, -1));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = { role: "assistant", content: next[next.length - 1].content + chunk };
          return next;
        });
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="mb-3 flex h-[520px] w-[360px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-lg border border-gold/20 bg-surface-2 shadow-2xl shadow-black/60 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-gold" />
                <p className="text-sm font-medium">Support Assistant</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-2 hover:bg-white/5 hover:text-foreground"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div ref={listRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                    m.role === "user" ? "self-end bg-gold text-black" : "self-start bg-surface text-foreground"
                  )}
                >
                  {m.content || (sending && i === messages.length - 1 ? "…" : "")}
                </div>
              ))}
            </div>

            <div className="border-t border-white/10 p-3">
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question..."
                  rows={1}
                  className="min-h-0 flex-1 resize-none py-2"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <Button onClick={send} disabled={sending || !input.trim()} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        onClick={() => setOpen((o) => !o)}
        size="icon"
        className="h-14 w-14 rounded-full shadow-lg"
        aria-label={open ? "Close chat" : "Open chat"}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </Button>
    </div>
  );
}
