// Attaches the product photos in public/products/photos (downloaded from
// Open Food Facts, matched by barcode — see prisma/data/product-photos.json)
// to their products.
//
//   npx tsx prisma/apply-photos.ts           # apply
//   npx tsx prisma/apply-photos.ts --dry-run # preview
//
// Only products still showing the placeholder image are changed, so a photo
// someone uploaded by hand in the admin is never overwritten. Safe to re-run.
// On Vercel it runs once during the build when APPLY_PHOTOS=1 (see the
// "vercel-build" script in package.json).
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

const PLACEHOLDER_IMAGE = "/products/placeholder.svg";
const DRY_RUN = process.argv.includes("--dry-run");

type Entry = { image: string; source: string; offCode: string };

async function main() {
  const file = path.join(process.cwd(), "prisma", "data", "product-photos.json");
  const mapping = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, Entry>;
  const barcodes = Object.keys(mapping);

  let applied = 0;
  let keptExisting = 0;
  let notFound = 0;
  for (const barcode of barcodes) {
    const entry = mapping[barcode];
    // Never point a product at a file that isn't actually deployed.
    if (!fs.existsSync(path.join(process.cwd(), "public", entry.image))) {
      console.warn(`Missing file for ${barcode}: ${entry.image}`);
      continue;
    }
    const product = await prisma.product.findUnique({ where: { barcode }, select: { id: true, imageUrl: true } });
    if (!product) {
      notFound++;
      continue;
    }
    if (product.imageUrl !== PLACEHOLDER_IMAGE) {
      keptExisting++;
      continue;
    }
    if (!DRY_RUN) await prisma.product.update({ where: { id: product.id }, data: { imageUrl: entry.image } });
    applied++;
  }

  console.log(
    `${DRY_RUN ? "Would apply" : "Applied"} ${applied} photos of ${barcodes.length}` +
      ` (${keptExisting} already had a photo, ${notFound} products not in this database).`
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
