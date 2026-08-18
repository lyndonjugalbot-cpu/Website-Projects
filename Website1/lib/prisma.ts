import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Standard Next.js singleton pattern so hot-reload in dev doesn't spawn a
// new PrismaClient (and a new connection pool) on every file save.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Builds the actual PrismaClient, wired to Postgres via the pg driver adapter.
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — see .env.example");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
