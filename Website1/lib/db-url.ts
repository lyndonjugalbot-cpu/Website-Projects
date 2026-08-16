import path from "node:path";

/**
 * Resolves a `file:./relative/path` DATABASE_URL to an absolute path,
 * anchored at the project root (process.cwd()).
 *
 * This exists because the Prisma CLI (via prisma.config.ts) and the
 * @prisma/adapter-better-sqlite3 driver used at runtime (lib/prisma.ts)
 * resolve *relative* sqlite file: URLs differently — the CLI resolves them
 * relative to prisma/schema.prisma, while the raw driver resolves them
 * relative to process.cwd(). Left unresolved, that mismatch silently
 * produces two different .db files. Resolving to an absolute path here
 * sidesteps both conventions and keeps the CLI and the app pointed at the
 * exact same file.
 */
export function resolveSqliteUrl(rawUrl: string): string {
  if (!rawUrl.startsWith("file:")) return rawUrl;
  const relativePath = rawUrl.slice("file:".length);
  if (path.isAbsolute(relativePath)) return rawUrl;
  return "file:" + path.resolve(process.cwd(), relativePath);
}
