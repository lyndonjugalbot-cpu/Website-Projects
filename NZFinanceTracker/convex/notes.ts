import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { parseScheduleFromText } from "./scheduleFromText";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";

// Ambient here (rather than relying on @types/node) so this file type-checks the same way
// whether it's built directly (convex/tsconfig.json) or pulled in transitively via the
// generated api.d.ts from src/ (tsconfig.app.json, which intentionally has no Node types).
declare const process: { env: { GEMINI_API_KEY?: string } };

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const withAudioUrls = await Promise.all(
      notes.map(async (note) => ({
        ...note,
        audioUrl: note.audioStorageId ? await ctx.storage.getUrl(note.audioStorageId) : null,
      })),
    );
    return withAudioUrls.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
});

const noteFields = {
  type: v.union(v.literal("text"), v.literal("checklist")),
  title: v.string(),
  body: v.string(),
  checklistItems: v.array(v.object({ id: v.string(), text: v.string(), done: v.boolean() })),
  color: v.string(),
  scheduledDate: v.union(v.string(), v.null()),
  scheduledTime: v.union(v.string(), v.null()),
  reminderEnabled: v.boolean(),
};

export const add = mutation({
  args: noteFields,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const now = new Date().toISOString();
    return await ctx.db.insert("notes", {
      ...args,
      userId,
      transcriptionStatus: "none",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: { id: v.id("notes"), ...noteFields },
  handler: async (ctx, { id, ...patch }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, { ...patch, updatedAt: new Date().toISOString() });
  },
});

export const remove = mutation({
  args: { id: v.id("notes") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    if (existing.audioStorageId) await ctx.storage.delete(existing.audioStorageId);
    await ctx.db.delete(id);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

export const attachAudio = mutation({
  args: { id: v.id("notes"), storageId: v.id("_storage") },
  handler: async (ctx, { id, storageId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    if (existing.audioStorageId) await ctx.storage.delete(existing.audioStorageId);
    await ctx.db.patch(id, {
      audioStorageId: storageId,
      transcript: undefined,
      transcriptionStatus: "pending",
      updatedAt: new Date().toISOString(),
    });
    await ctx.scheduler.runAfter(0, internal.notes.transcribeAudio, { noteId: id });
  },
});

export const retryTranscription = mutation({
  args: { id: v.id("notes") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId || !existing.audioStorageId) throw new Error("Not found");
    await ctx.db.patch(id, { transcriptionStatus: "pending" });
    await ctx.scheduler.runAfter(0, internal.notes.transcribeAudio, { noteId: id });
  },
});

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export const transcribeAudio = internalAction({
  args: { noteId: v.id("notes") },
  handler: async (ctx, { noteId }) => {
    try {
      const note = await ctx.runQuery(internal.notes.getForTranscription, { noteId });
      if (!note?.audioStorageId) return;

      const blob = await ctx.storage.get(note.audioStorageId);
      if (!blob) throw new Error("Audio blob not found in storage");
      const base64Audio = arrayBufferToBase64(await blob.arrayBuffer());

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: "Transcribe this audio recording exactly. Reply with only the transcript text, no commentary." },
                  { inline_data: { mime_type: blob.type || "audio/webm", data: base64Audio } },
                ],
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Gemini transcription failed: ${response.status} ${await response.text()}`);
      }
      const result = await response.json();
      const transcript: string = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
      const parsedSchedule = transcript ? parseScheduleFromText(transcript) : null;

      await ctx.runMutation(internal.notes.saveTranscript, {
        noteId,
        transcript,
        status: "done",
        parsedSchedule: parsedSchedule ?? undefined,
      });
    } catch (error) {
      console.error("Transcription failed", error);
      await ctx.runMutation(internal.notes.saveTranscript, { noteId, transcript: "", status: "failed" });
    }
  },
});

export const getForTranscription = internalQuery({
  args: { noteId: v.id("notes") },
  handler: async (ctx, { noteId }) => {
    const note = await ctx.db.get(noteId);
    return note ? { audioStorageId: note.audioStorageId ?? null } : null;
  },
});

export const saveTranscript = internalMutation({
  args: {
    noteId: v.id("notes"),
    transcript: v.string(),
    status: v.union(v.literal("done"), v.literal("failed")),
    parsedSchedule: v.optional(v.object({ date: v.string(), time: v.union(v.string(), v.null()) })),
  },
  handler: async (ctx, { noteId, transcript, status, parsedSchedule }) => {
    const note = await ctx.db.get(noteId);
    if (!note) return;
    // Only auto-schedule if the note isn't already scheduled, so we never clobber a date the user chose themselves.
    const schedulePatch =
      parsedSchedule && !note.scheduledDate
        ? {
            scheduledDate: parsedSchedule.date,
            scheduledTime: parsedSchedule.time,
            reminderEnabled: parsedSchedule.time !== null,
          }
        : {};
    await ctx.db.patch(noteId, { transcript, transcriptionStatus: status, ...schedulePatch });
  },
});
