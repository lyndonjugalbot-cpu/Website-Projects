import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { rateLimit, clientIp } from "@/lib/rate-limit";

type RouteContext = { params: Promise<{ conversationId: string }> };

async function assertParticipant(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) return null;
  if (conversation.participantAId !== userId && conversation.participantBId !== userId) return null;
  return conversation;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { conversationId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversation = await assertParticipant(conversationId, session.user.id);
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [messages] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      include: { sender: { select: { username: true, displayName: true, avatarUrl: true } } },
    }),
    prisma.message.updateMany({
      where: { conversationId, senderId: { not: session.user.id }, isRead: false },
      data: { isRead: true },
    }),
  ]);

  return NextResponse.json({ conversation, messages });
}

const replySchema = z.object({ body: z.string().min(1).max(2000) });

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { conversationId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = rateLimit(`message:${session.user.id}:${clientIp(req.headers)}`, 30, 10 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "You're sending messages too quickly. Slow down." }, { status: 429 });
  }

  const conversation = await assertParticipant(conversationId, session.user.id);
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (conversation.isBlocked) return NextResponse.json({ error: "This conversation is blocked." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Message cannot be empty." }, { status: 400 });

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, senderId: session.user.id, body: parsed.data.body },
    }),
    prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
  ]);

  return NextResponse.json({ ok: true, message });
}
