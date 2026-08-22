import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Haiku 4.5 by default — a support bot answering FAQ/account-lookup questions
// doesn't need Sonnet/Opus-level reasoning, and it keeps per-message cost down.
export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

export const AI_MAX_TOKENS = 1024;
export const AI_MAX_TOOL_ITERATIONS = 4;
