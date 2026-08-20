import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { sendEmail, verifyEmailTemplate } from "@/lib/email";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  const limited = rateLimit(`register:${ip}`, 5, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const [existingEmail, existingUsername] = await Promise.all([
    prisma.user.findUnique({ where: { email: data.email.toLowerCase() } }),
    prisma.user.findUnique({ where: { username: data.username } }),
  ]);
  if (existingEmail) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }
  if (existingUsername) {
    return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  const user = await prisma.user.create({
    data: {
      fullName: data.fullName,
      username: data.username,
      email: data.email.toLowerCase(),
      passwordHash,
      location: data.location,
      acceptedTermsAt: new Date(),
      acceptedPrivacyAt: new Date(),
    },
  });

  const token = randomUUID();
  await prisma.verificationToken.create({
    data: {
      identifier: user.email,
      token,
      purpose: "email-verify",
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const verifyUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/verify-email?token=${token}&email=${encodeURIComponent(user.email)}`;
  await sendEmail({
    to: user.email,
    subject: "Verify your email — Wots TCG Vault NZ",
    html: verifyEmailTemplate(user.fullName, verifyUrl),
  });

  await logAudit({
    actorId: user.id,
    action: "user.register",
    targetType: "User",
    targetId: user.id,
    ipAddress: ip,
  });

  return NextResponse.json({ ok: true, userId: user.id });
}
