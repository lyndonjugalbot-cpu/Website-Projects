import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type Anthropic from "@anthropic-ai/sdk";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { chatMessageSchema } from "@/lib/validations/chat";
import { anthropic, AI_MODEL, AI_MAX_TOKENS, AI_MAX_TOOL_ITERATIONS } from "@/lib/ai/anthropic";
import { AI_TOOLS, executeTool } from "@/lib/ai/tools";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { getPaymentSettings } from "@/lib/platform-settings";

const HISTORY_LIMIT = 20;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversation = await prisma.aiConversation.findFirst({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  return NextResponse.json({ conversation });
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Chat is not configured yet." }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id as string | undefined;

  const ip = clientIp(req.headers);
  const limited = userId
    ? rateLimit(`chat:${userId}`, 20, 10 * 60 * 1000)
    : rateLimit(`chat:${ip}`, 8, 10 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "You're sending messages too quickly. Slow down a moment." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = chatMessageSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  let conversation: { id: string } | null = null;
  const history: Anthropic.MessageParam[] = [];

  if (userId) {
    if (data.conversationId) {
      const existing = await prisma.aiConversation.findUnique({
        where: { id: data.conversationId },
        include: { messages: { orderBy: { createdAt: "asc" }, take: HISTORY_LIMIT } },
      });
      if (!existing || existing.userId !== userId) {
        return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
      }
      conversation = existing;
      for (const m of existing.messages) {
        history.push({ role: m.role === "USER" ? "user" : "assistant", content: m.content });
      }
    } else {
      conversation = await prisma.aiConversation.create({
        data: { userId, title: data.message.slice(0, 80) },
      });
    }
  }

  const settings = await getPaymentSettings();
  const system = buildSystemPrompt(settings, Boolean(userId));
  const tools = userId ? AI_TOOLS : [];
  const messages: Anthropic.MessageParam[] = [...history, { role: "user", content: data.message }];

  const encoder = new TextEncoder();
  let assistantText = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let current = messages;
        for (let i = 0; i < AI_MAX_TOOL_ITERATIONS; i++) {
          const msgStream = anthropic.messages.stream({
            model: AI_MODEL,
            max_tokens: AI_MAX_TOKENS,
            temperature: 0.3,
            system,
            messages: current,
            tools,
          });
          msgStream.on("text", (delta) => {
            assistantText += delta;
            controller.enqueue(encoder.encode(delta));
          });
          const final = await msgStream.finalMessage();

          if (final.stop_reason !== "tool_use") break;

          const toolUses = final.content.filter(
            (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
          );
          if (toolUses.length === 0) break;

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const toolUse of toolUses) {
            const result = await executeTool(toolUse.name, toolUse.input, userId as string);
            toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) });
          }

          current = [...current, { role: "assistant", content: final.content }, { role: "user", content: toolResults }];
        }

        if (conversation && assistantText) {
          await prisma.aiMessage.createMany({
            data: [
              { conversationId: conversation.id, role: "USER", content: data.message },
              { conversationId: conversation.id, role: "ASSISTANT", content: assistantText },
            ],
          });
          await prisma.aiConversation.update({
            where: { id: conversation.id },
            data: { updatedAt: new Date() },
          });
        }
      } catch (err) {
        console.error("[/api/chat] stream error:", err);
        controller.error(err);
        return;
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Conversation-Id": conversation?.id ?? "",
    },
  });
}
