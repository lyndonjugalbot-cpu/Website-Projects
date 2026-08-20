"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "!bg-surface-2 !border !border-gold/25 !text-foreground !shadow-2xl !shadow-black/50",
          title: "!text-foreground",
          description: "!text-muted",
          actionButton: "!bg-gold !text-black",
          cancelButton: "!bg-charcoal !text-muted",
          success: "!border-success/40",
          error: "!border-danger/40",
        },
      }}
    />
  );
}
