// Points products at their studio-style photos in public/products/studio
// (prisma/data/studio-photos.json: barcode -> image path).
//
//   npx tsx prisma/apply-studio-photos.ts           # apply
//   npx tsx prisma/apply-studio-photos.ts --dry-run # preview
//
// Only products still on the placeholder or on a raw Open Food Facts photo
// (/products/photos/...) are changed, so an image uploaded by hand in the
// admin is never overwritten. Safe to re-run. On Vercel it runs once during
// the build when APPLY_PHOTOS=1 (see the "vercel-build" script).
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

const PLACEHOLDER_IMAGE = "/products/placeholder.svg";
const RAW_PHOTO_PREFIX = "/products/photos/";
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const file = path.join(process.cwd(), "prisma", "data", "studio-photos.json");
  const mapping = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, string>;

  let applied = 0;
  let keptExisting = 0;
  let notFound = 0;
  for (const [barcode, image] of Object.entries(mapping)) {
    if (!fs.existsSync(path.join(process.cwd(), "public", image))) {
      console.warn(`Missing file for ${barcode}: ${image}`);
      continue;
    }
    const product = await prisma.product.findUnique({ where: { barcode }, select: { id: true, imageUrl: true } });
    if (!product) {
      notFound++;
      continue;
    }
    if (product.imageUrl !== PLACEHOLDER_IMAGE && !product.imageUrl.startsWith(RAW_PHOTO_PREFIX)) {
      keptExisting++;
      continue;
    }
    if (!DRY_RUN) await prisma.product.update({ where: { id: product.id }, data: { imageUrl: image } });
    applied++;
  }

  console.log(
    `${DRY_RUN ? "Would apply" : "Applied"} ${applied} studio photos of ${Object.keys(mapping).length}` +
      ` (${keptExisting} have a custom photo, ${notFound} products not in this database).`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
