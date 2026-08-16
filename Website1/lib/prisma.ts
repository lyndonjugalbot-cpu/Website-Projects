import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { resolveSqliteUrl } from "@/lib/db-url";

// Standard Next.js singleton pattern so hot-reload in dev doesn't spawn a
// new PrismaClient (and a new SQLite connection) on every file save.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({
    url: resolveSqliteUrl(process.env.DATABASE_URL ?? "file:./prisma/dev.db"),
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
