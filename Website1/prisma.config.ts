// Used by the Prisma CLI only (migrate, studio, db push). The app itself
// reads DATABASE_URL directly at runtime via lib/prisma.ts — Next.js loads
// .env automatically, but this standalone CLI config needs dotenv.
import "dotenv/config";
import { defineConfig } from "prisma/config";

// Schema migrations (DDL + advisory locks) run more reliably over a direct
// connection than through a pooler like PgBouncer — Neon (and Vercel's
// Postgres integration, which is Neon-backed) exposes both, so prefer the
// unpooled one here if it's set. DATABASE_URL is still used by everything
// else (the app at runtime, `prisma db seed`, local dev without a pooler).
const migrationUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationUrl,
  },
});
