import { prisma } from "@/lib/prisma";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

/** Appends -2, -3, ... until the slug is unique, ignoring `excludeId` (for edits). */
export async function uniqueProductSlug(base: string, excludeId?: string): Promise<string> {
  const baseSlug = slugify(base) || "product";
  let slug = baseSlug;
  let n = 2;
  while (await prisma.product.findFirst({ where: { slug, id: excludeId ? { not: excludeId } : undefined } })) {
    slug = `${baseSlug}-${n}`;
    n += 1;
  }
  return slug;
}
