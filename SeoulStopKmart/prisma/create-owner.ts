// Creates an OWNER login — or resets the password of an existing user and
// makes them an active OWNER. Unlike prisma/seed.ts it adds no demo products,
// so it's safe to run against the live database.
//
//   read -s -p "New owner password: " PW; echo
//   DATABASE_URL="postgres://…" OWNER_EMAIL="you@example.com" OWNER_PASSWORD="$PW" \
//     npx tsx prisma/create-owner.ts
//
// DATABASE_URL given on the command line wins over the one in .env. The
// password is read from the environment and is never printed.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const MIN_PASSWORD_LENGTH = 12;

async function main() {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD;
  const name = process.env.OWNER_NAME?.trim() || "Store Owner";

  if (!email || !email.includes("@")) throw new Error("Set OWNER_EMAIL to a valid email address.");
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Set OWNER_PASSWORD to at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? "").host;
    } catch {
      return "(unknown database)";
    }
  })();

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({ where: { email } });
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "OWNER", isActive: true },
    create: { name, email, passwordHash, role: "OWNER" },
  });

  console.log(`${existing ? "Reset password and set OWNER role for" : "Created OWNER account for"} ${email}`);
  console.log(`Database host: ${host}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
