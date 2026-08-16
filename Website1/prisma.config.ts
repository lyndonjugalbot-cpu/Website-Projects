// Used by the Prisma CLI only (migrate, studio, db push). The app itself
// reads DATABASE_URL directly at runtime via lib/prisma.ts — Next.js loads
// .env automatically, but this standalone CLI config needs dotenv.
import "dotenv/config";
import { defineConfig } from "prisma/config";
import { resolveSqliteUrl } from "./lib/db-url";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: resolveSqliteUrl(process.env.DATABASE_URL ?? "file:./prisma/dev.db"),
  },
});
