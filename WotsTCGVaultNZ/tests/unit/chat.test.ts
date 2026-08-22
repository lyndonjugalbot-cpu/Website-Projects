import { describe, it, expect } from "vitest";
import { chatMessageSchema } from "@/lib/validations/chat";

describe("chatMessageSchema", () => {
  it("accepts a plain message with no conversationId", () => {
    const parsed = chatMessageSchema.safeParse({ message: "How does buyer protection work?" });
    expect(parsed.success).toBe(true);
  });

  it("rejects an empty message", () => {
    const parsed = chatMessageSchema.safeParse({ message: "" });
    expect(parsed.success).toBe(false);
  });

  it("rejects a message over 2000 characters", () => {
    const parsed = chatMessageSchema.safeParse({ message: "a".repeat(2001) });
    expect(parsed.success).toBe(false);
  });

  it("rejects a missing message field", () => {
    const parsed = chatMessageSchema.safeParse({ conversationId: "abc" });
    expect(parsed.success).toBe(false);
  });
});
