// Backs the admin Inventory page: the stock-movement ledger view (GET) and
// the manual stock adjustment form (POST). Both require Manager/Owner.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, UnauthorizedError } from "@/lib/authz";
import { recordStockMovement } from "@/lib/inventory";

// Recent stock movements, optionally filtered by product or movement type.
export async function GET(request: NextRequest) {
  try {
    await requireRole("MANAGER");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const { searchParams } = request.nextUrl;
  const productId = searchParams.get("productId") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  const category = searchParams.get("category") ?? undefined;

  const movements = await prisma.stockMovement.findMany({
    where: {
      ...(productId ? { productId } : {}),
      ...(type ? { type: type as never } : {}),
      ...(category ? { product: { category: category as never } } : {}),
    },
    include: { product: { select: { name: true, imageUrl: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ movements });
}

// Two kinds of stock update. A restock adds the quantity that just arrived
// (logged as RESTOCK); an adjustment sets the stock to a counted figure to
// fix a mistake, damaged or returned items (logged as MANUAL_ADJUSTMENT).
const adjustSchema = z.object({
  kind: z.literal("adjust").default("adjust"),
  productId: z.string().min(1),
  newStock: z.number().int().min(0, "Stock can't be negative"),
  reason: z.string().trim().min(1, "A reason is required").max(500),
});

const restockSchema = z.object({
  kind: z.literal("restock"),
  productId: z.string().min(1),
  quantity: z.number().int().min(1, "Enter how many units arrived").max(100_000),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

// Manually corrects a product's stock (e.g. after a physical recount, or
// damaged goods) — always requires a reason, recorded as a MANUAL_ADJUSTMENT movement.
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireRole("MANAGER");
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const body = await request.json().catch(() => null);
  const userName = session.user.name ?? session.user.email ?? "Staff";

  if (body && typeof body === "object" && (body as { kind?: unknown }).kind === "restock") {
    const restock = restockSchema.safeParse(body);
    if (!restock.success) {
      return NextResponse.json({ error: restock.error.issues[0]?.message ?? "Invalid restock" }, { status: 400 });
    }
    const target = await prisma.product.findUnique({ where: { id: restock.data.productId } });
    if (!target) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    await prisma.$transaction(async (tx) => {
      await recordStockMovement(tx, {
        productId: target.id,
        quantityChange: restock.data.quantity,
        type: "RESTOCK",
        userName,
        note: restock.data.note || null,
      });
    });
    return NextResponse.json({ ok: true });
  }

  const parsed = adjustSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid adjustment" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: parsed.data.productId } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const delta = parsed.data.newStock - product.stock;
  if (delta === 0) {
    return NextResponse.json({ error: "New quantity is the same as current stock" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await recordStockMovement(tx, {
      productId: product.id,
      quantityChange: delta,
      type: "MANUAL_ADJUSTMENT",
      userName,
      note: parsed.data.reason,
    });
  });

  return NextResponse.json({ ok: true });
}
