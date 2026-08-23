import OpenAI from "openai";

// Gemini exposes an OpenAI-compatible endpoint, so we can use the standard
// `openai` SDK (chat completions + tool calling) instead of a separate
// native Gemini SDK.
export const gemini = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

// Flash-tier model — a support bot answering FAQ/account-lookup questions
// doesn't need Pro-level reasoning, and it keeps latency/cost down.
export const AI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

export const AI_MAX_TOKENS = 1024;
export const AI_MAX_TOOL_ITERATIONS = 4;
