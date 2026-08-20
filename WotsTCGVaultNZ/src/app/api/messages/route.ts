import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { messageSchema } from "@/lib/validations/order";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [{ participantAId: session.user.id }, { participantBId: session.user.id }],
    },
    orderBy: { updatedAt: "desc" },
    include: {
      participantA: { select: { id: true, username: true, displayName: true, fullName: true, avatarUrl: true } },
      participantB: { select: { id: true, username: true, displayName: true, fullName: true, avatarUrl: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return NextResponse.json({ conversations });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = clientIp(req.headers);
  const limited = rateLimit(`message:${session.user.id}:${ip}`, 30, 10 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "You're sending messages too quickly. Slow down." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  if (data.recipientId === session.user.id) {
    return NextResponse.json({ error: "You cannot message yourself." }, { status: 400 });
  }

  const blocked = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: data.recipientId, blockedId: session.user.id },
        { blockerId: session.user.id, blockedId: data.recipientId },
      ],
    },
  });
  if (blocked) return NextResponse.json({ error: "You cannot message this user." }, { status: 403 });

  const [a, b] = [session.user.id, data.recipientId].sort();
  let conversation = await prisma.conversation.findFirst({
    where: { participantAId: a, participantBId: b, listingRefId: data.listingId ?? null },
  });
  if (conversation) {
    conversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });
  } else {
    conversation = await prisma.conversation.create({
      data: { participantAId: a, participantBId: b, listingRefId: data.listingId },
    });
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: session.user.id,
      listingRefId: data.listingId,
      body: data.body,
    },
  });

  return NextResponse.json({ ok: true, conversationId: conversation.id, message });
}
