import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reviewSchema } from "@/lib/validations/order";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const order = await prisma.order.findUnique({ where: { id: data.orderId }, include: { items: true } });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.buyerId !== session.user.id) {
    return NextResponse.json({ error: "You can only review orders you placed." }, { status: 403 });
  }
  if (order.status !== "COMPLETED") {
    return NextResponse.json({ error: "You can only review completed orders." }, { status: 400 });
  }

  const sellerId = order.items[0]?.sellerId;
  if (!sellerId) return NextResponse.json({ error: "No seller found for this order." }, { status: 400 });

  const existing = await prisma.review.findFirst({ where: { orderId: order.id, authorId: session.user.id } });
  if (existing) return NextResponse.json({ error: "You've already reviewed this order." }, { status: 409 });

  const review = await prisma.review.create({
    data: {
      orderId: order.id,
      authorId: session.user.id,
      subjectId: sellerId,
      rating: data.rating,
      comment: data.comment,
    },
  });

  return NextResponse.json({ ok: true, review });
}
