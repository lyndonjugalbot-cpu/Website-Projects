import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/require-staff";
import { logAudit } from "@/lib/audit";
import { getPaymentSettings, updatePaymentSettings } from "@/lib/platform-settings";
import { z } from "zod";

export async function GET() {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const settings = await getPaymentSettings();
  return NextResponse.json({ settings });
}

const schema = z.object({
  platformCommissionBps: z.number().int().min(0).max(3000),
  platformFixedFeeCents: z.number().int().min(0).max(100_000),
  buyerPaysFees: z.boolean(),
  buyerFeeBps: z.number().int().min(0).max(1000),
  reserveBps: z.number().int().min(0).max(3000),
  inspectionPeriodHours: z.number().int().min(1).max(720),
  autoPayoutEnabled: z.boolean(),
  maxAutoPayoutCents: z.number().int().min(0),
  maxDeliveryWaitDays: z.number().int().min(1).max(180),
  reservationTtlMinutes: z.number().int().min(30).max(1440),
});

/** Full or partial update — every field is optional here so the admin UI can save one section at a time. */
export async function PATCH(req: NextRequest) {
  const guard = await requireStaff("settings.manage");
  if (guard.response) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = schema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const settings = await updatePaymentSettings(parsed.data, guard.session!.user.id);

  await logAudit({
    actorId: guard.session!.user.id,
    action: "settings.update",
    targetType: "PlatformSetting",
    targetId: "payment_settings",
    metadata: parsed.data,
  });

  return NextResponse.json({ ok: true, settings });
}
