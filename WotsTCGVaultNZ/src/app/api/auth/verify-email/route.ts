import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { token, email } = await req.json().catch(() => ({ token: null, email: null }));
  if (!token || !email) {
    return NextResponse.json({ error: "Missing token or email." }, { status: 400 });
  }

  const record = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier: email, token } },
  });

  if (!record || record.purpose !== "email-verify" || record.expires < new Date()) {
    return NextResponse.json({ error: "This verification link is invalid or has expired." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { email },
      data: { isEmailVerified: true, emailVerified: new Date() },
    }),
    prisma.verificationToken.delete({
      where: { identifier_token: { identifier: email, token } },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
