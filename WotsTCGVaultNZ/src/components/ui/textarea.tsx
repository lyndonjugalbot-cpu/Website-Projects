import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-24 w-full rounded-md border border-white/10 bg-surface px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-2 transition-colors",
          "focus-visible:outline-none focus-visible:border-gold/60 focus-visible:ring-2 focus-visible:ring-gold/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
