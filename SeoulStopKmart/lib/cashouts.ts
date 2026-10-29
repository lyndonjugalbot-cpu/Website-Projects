// Cash taken out of the register at the POS (salary, cash advances, bills,
// supplies…). Called from app/api/admin/pos/cash-outs/*. A cash-out lowers
// the drawer's expected balance — see expectedBalances() in lib/shifts.ts.
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CASH_OUT_KEYS } from "@/lib/cashout-config";
import { getOpenCashSession, ShiftError } from "@/lib/shifts";

export const cashOutInputSchema = z.object({
  category: z.enum(CASH_OUT_KEYS),
  amountCentavos: z.number().int().min(1, "Enter an amount greater than 0").max(100_000_000),
  paidFrom: z.enum(["cash", "gcash"]).default("cash"),
  payee: z.string().trim().max(200).optional().or(z.literal("")),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export type CashOutInput = z.infer<typeof cashOutInputSchema>;

const STAFF_VOID_WINDOW_MS = 10 * 60_000; // staff can fix their own entry for 10 minutes

/** Records a cash-out. The cashier needs an open cash count, so the drawer figure stays accurate. */
export async function createCashOut(actor: { id: string; name: string }, input: CashOutInput) {
  const session = await getOpenCashSession(actor.id);
  if (!session) {
    throw new ShiftError("Record your start-of-shift cash count first, so the cash out comes off your drawer.");
  }
  if ((input.category === "SALARY" || input.category === "CASH_ADVANCE") && !input.payee) {
    throw new ShiftError("Enter the employee's name.");
  }
  return prisma.cashOut.create({
    data: {
      cashierId: actor.id,
      cashierName: actor.name,
      category: input.category,
      payee: input.payee || null,
      amountCentavos: input.amountCentavos,
      paidFrom: input.paidFrom,
      note: input.note || null,
    },
  });
}

/** This cashier's cash-outs since their current cash count opened (newest first). */
export async function listMyCashOuts(userId: string) {
  const session = await getOpenCashSession(userId);
  if (!session) return { hasOpenSession: false, cashOuts: [] };
  const cashOuts = await prisma.cashOut.findMany({
    where: { cashierId: userId, createdAt: { gte: session.openedAt } },
    orderBy: { createdAt: "desc" },
  });
  return { hasOpenSession: true, cashOuts };
}

/**
 * Voids a cash-out (puts the money back in the drawer's expected total).
 * Staff can void their own entry within a few minutes; Manager/Owner any time.
 * A reason is always required.
 */
export async function voidCashOut(
  id: string,
  actor: { id: string; name: string; role: "OWNER" | "MANAGER" | "STAFF" },
  reason: string
) {
  if (!reason.trim()) throw new ShiftError("A reason is required to void a cash out.");
  const entry = await prisma.cashOut.findUnique({ where: { id } });
  if (!entry) throw new ShiftError("Cash out not found.");
  if (entry.voidedAt) throw new ShiftError("This cash out was already voided.");
  const isOwnRecent = entry.cashierId === actor.id && Date.now() - entry.createdAt.getTime() <= STAFF_VOID_WINDOW_MS;
  if (actor.role === "STAFF" && !isOwnRecent) {
    throw new ShiftError("Only the cashier (within 10 minutes) or a manager/owner can void this cash out.");
  }
  const { count } = await prisma.cashOut.updateMany({
    where: { id, voidedAt: null },
    data: { voidedAt: new Date(), voidedByName: actor.name, voidReason: reason.trim() },
  });
  if (count === 0) throw new ShiftError("This cash out was already voided.");
}
