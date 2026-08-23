import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type OpenAI from "openai";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { chatMessageSchema } from "@/lib/validations/chat";
import { gemini, AI_MODEL, AI_MAX_TOKENS, AI_MAX_TOOL_ITERATIONS } from "@/lib/ai/gemini";
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
  if (!process.env.GEMINI_API_KEY) {
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
  const history: OpenAI.ChatCompletionMessageParam[] = [];

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
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    ...history,
    { role: "user", content: data.message },
  ];

  const encoder = new TextEncoder();
  let assistantText = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let current = messages;
        for (let i = 0; i < AI_MAX_TOOL_ITERATIONS; i++) {
          const completion = await gemini.chat.completions.create({
            model: AI_MODEL,
            max_tokens: AI_MAX_TOKENS,
            temperature: 0.3,
            messages: current,
            tools: tools.length ? tools : undefined,
            stream: true,
          });

          let turnText = "";
          let finishReason: string | null = null;
          const toolCallsAcc: Record<number, { id?: string; name: string; args: string }> = {};

          for await (const chunk of completion) {
            const choice = chunk.choices[0];
            if (!choice) continue;

            if (choice.delta?.content) {
              turnText += choice.delta.content;
              assistantText += choice.delta.content;
              controller.enqueue(encoder.encode(choice.delta.content));
            }

            if (choice.delta?.tool_calls) {
              for (const tc of choice.delta.tool_calls) {
                const acc = toolCallsAcc[tc.index] ?? { name: "", args: "" };
                if (tc.id) acc.id = tc.id;
                if (tc.function?.name) acc.name += tc.function.name;
                if (tc.function?.arguments) acc.args += tc.function.arguments;
                toolCallsAcc[tc.index] = acc;
              }
            }

            if (choice.finish_reason) finishReason = choice.finish_reason;
          }

          const toolCallEntries = Object.values(toolCallsAcc);
          if (finishReason !== "tool_calls" || toolCallEntries.length === 0) break;

          const toolCalls: OpenAI.ChatCompletionMessageFunctionToolCall[] = toolCallEntries.map((tc, idx) => ({
            id: tc.id ?? `call_${idx}`,
            type: "function" as const,
            function: { name: tc.name, arguments: tc.args },
          }));

          current = [...current, { role: "assistant", content: turnText || null, tool_calls: toolCalls }];

          for (const toolCall of toolCalls) {
            let parsedArgs: unknown = {};
            try {
              parsedArgs = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
            } catch {
              parsedArgs = {};
            }
            const result = await executeTool(toolCall.function.name, parsedArgs, userId as string);
            current = [...current, { role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) }];
          }
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
