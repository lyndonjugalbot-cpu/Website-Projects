import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { sendEmail, resetPasswordTemplate } from "@/lib/email";

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  const limited = rateLimit(`forgot-password:${ip}`, 5, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });

  // Always respond 200 to avoid leaking which emails have accounts.
  if (user && user.passwordHash) {
    const token = randomUUID();
    await prisma.verificationToken.create({
      data: {
        identifier: user.email,
        token,
        purpose: "password-reset",
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const resetUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;
    await sendEmail({
      to: user.email,
      subject: "Reset your password — Wots TCG Vault NZ",
      html: resetPasswordTemplate(user.fullName, resetUrl),
    });
  }

  return NextResponse.json({ ok: true });
}
