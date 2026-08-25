// TEMPORARY, ONE-OFF: creates/promotes a single hardcoded OWNER account.
// Protected by BOOTSTRAP_OWNER_SECRET (set only in Production). Delete this
// route and the env var immediately after use — never leave it deployed.
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const EMAIL = "seoulstopkmart@gmail.com";
const PASSWORD = "Password123-";
const NAME = "Seoul Stop Kmart";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-bootstrap-secret");
  if (!secret || secret !== process.env.BOOTSTRAP_OWNER_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash, role: "OWNER", isActive: true },
    create: { name: NAME, email: EMAIL, passwordHash, role: "OWNER", isActive: true },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  return NextResponse.json({ user });
}
