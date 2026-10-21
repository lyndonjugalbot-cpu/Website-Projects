// Imports the store's real catalog (prisma/data/products-master.csv, exported
// from the previous POS) with its current stock counts.
//
//   npx tsx prisma/import-products.ts              # import / update
//   npx tsx prisma/import-products.ts --dry-run    # show what would happen
//   npx tsx prisma/import-products.ts --remove-demo  # also delete the seed demo products
//   npx tsx prisma/import-products.ts --reset-stock  # overwrite stock of existing products too
//
// Safe to re-run: products are matched by slug (derived from the name; the
// SKU is appended when two products share a name). Existing products only
// have their name/price/cost/barcodes/group refreshed — stock is left alone
// unless --reset-stock is passed, so re-running after live sales never
// wipes real stock. Every stock set writes a StockMovement ledger row.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import type { ProductCategory } from "@/generated/prisma/enums";

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const REMOVE_DEMO = args.has("--remove-demo");
const RESET_STOCK = args.has("--reset-stock");

const PLACEHOLDER_IMAGE = "/products/placeholder.svg";
const DEFAULT_LOW_STOCK_THRESHOLD = 5;

// The store's own product groups -> the storefront's category enum. The
// original group is also kept on Product.groupName for the POS filter.
const GROUP_TO_CATEGORY: Record<string, ProductCategory> = {
  snacks: "SNACKS",
  chocolate: "SNACKS",
  seaweeds: "SNACKS",
  "canned drinks": "BEVERAGES",
  "1.5l drinks": "BEVERAGES",
  "juice pouch": "BEVERAGES",
  water: "BEVERAGES",
  soju: "BEVERAGES",
  "alcoholic drinks": "BEVERAGES",
  "coffee sticks": "BEVERAGES",
  ramen: "INSTANT_NOODLES",
  "ramen toppings": "INSTANT_NOODLES",
  "ice cream": "FROZEN_FOOD",
  "frozen section": "FROZEN_FOOD",
  samgyupsal: "FROZEN_FOOD",
  corndog: "FROZEN_FOOD",
  groceries: "FRESH_GROCERY",
  "luncheon meats": "FRESH_GROCERY",
  kimchi: "FRESH_GROCERY",
  topokki: "FRESH_GROCERY",
  tteokbokki: "FRESH_GROCERY",
  kimbap: "FRESH_GROCERY",
  onigiri: "FRESH_GROCERY",
  meals: "FRESH_GROCERY",
  streetfood: "FRESH_GROCERY",
  beauty: "BEAUTY_PERSONAL_CARE",
};

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((v) => v !== "")) rows.push(row);
  }
  const [header, ...body] = rows;
  const cleanHeader = header.map((h) => h.replace(/^﻿/, "").trim());
  return body.map((r) => Object.fromEntries(cleanHeader.map((h, i) => [h, (r[i] ?? "").trim()])));
}

const toCentavos = (v: string) => Math.round((Number.parseFloat(v) || 0) * 100);

async function main() {
  const file = path.join(process.cwd(), "prisma", "data", "products-master.csv");
  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  console.log(`Read ${rows.length} products from ${path.relative(process.cwd(), file)}${DRY_RUN ? " (dry run)" : ""}`);

  const notes = { inactive: [] as string[], clamped: [] as string[], droppedBarcodes: [] as string[], posOnly: [] as string[] };
  const usedSlugs = new Set<string>();
  const usedBarcodes = new Set<string>();

  const products = rows.map((r) => {
    const name = r.Name.replace(/\s+/g, " ").trim();
    const sku = r.SKU;

    let slug = slugify(name) || `product-${sku}`;
    if (usedSlugs.has(slug)) slug = `${slug}-${sku}`.slice(0, 120);
    usedSlugs.add(slug);

    // "a|b" => several scannable codes. Keep only real numeric codes (the
    // export has a few junk values like "COOKING CHARGE: 30") and make sure
    // no code is claimed by two products, since Product.barcode is unique.
    const codes = r.Barcode.split("|").map((c) => c.trim()).filter(Boolean);
    const valid: string[] = [];
    for (const code of codes) {
      if (!/^\d{3,}$/.test(code)) notes.droppedBarcodes.push(`${name}: "${code}"`);
      else if (usedBarcodes.has(code)) notes.droppedBarcodes.push(`${name}: "${code}" (duplicate)`);
      else {
        usedBarcodes.add(code);
        valid.push(code);
      }
    }

    const group = r.ProductGroup && r.ProductGroup.toLowerCase() !== "null" ? r.ProductGroup.trim() : null;
    const category = (group && GROUP_TO_CATEGORY[group.toLowerCase()]) || "OTHER";

    const isService = r.IsService === "1";
    const priceCentavos = toCentavos(r.Price);
    const costCentavos = toCentavos(r.Cost);
    const qty = Math.round(Number.parseFloat(r.Quantity) || 0);
    const stock = Math.max(0, qty);
    if (qty < 0) notes.clamped.push(`${name}: stock ${qty} -> 0`);

    // Hidden from the register when the old POS had it disabled, or when it
    // has no price (a ₱0 item would be sellable for free).
    const inactive = r.IsEnabled === "0" || priceCentavos <= 0;
    if (inactive) notes.inactive.push(`${name} (${r.IsEnabled === "0" ? "disabled in old POS" : "price is 0"})`);
    if (isService) notes.posOnly.push(name);

    const reorder = Number.parseInt(r.ReorderPoint, 10);

    return {
      sku,
      slug,
      name: name.slice(0, 200),
      description: group ? `${group} — ${name}` : name,
      priceCentavos,
      // Cost 0 means "not entered" in the export, not "free": store as
      // unknown so profit reports flag it instead of overstating margin.
      costCentavos: costCentavos > 0 ? costCentavos : null,
      barcode: valid[0] ?? null,
      altBarcodes: valid.slice(1),
      groupName: group,
      category,
      stock: isService ? 0 : stock,
      lowStockThreshold: Number.isFinite(reorder) && reorder >= 0 ? reorder : DEFAULT_LOW_STOCK_THRESHOLD,
      posOnly: isService,
      allowOversell: isService,
      status: inactive ? ("INACTIVE" as const) : ("ACTIVE" as const),
    };
  });

  if (DRY_RUN) {
    console.log(`Would import ${products.length} products (${products.filter((p) => p.posOnly).length} POS-only).`);
  } else {
    let created = 0;
    let updated = 0;
    for (const p of products) {
      const { stock, sku: _sku, ...rest } = p;
      void _sku;
      const existing = await prisma.product.findUnique({ where: { slug: p.slug } });
      if (!existing) {
        const product = await prisma.product.create({ data: { ...rest, stock, imageUrl: PLACEHOLDER_IMAGE } });
        if (stock > 0) {
          await prisma.stockMovement.create({
            data: {
              productId: product.id,
              previousStock: 0,
              quantityChange: stock,
              newStock: stock,
              type: "RESTOCK",
              userName: "Catalog import",
              note: "Opening stock from the previous POS",
            },
          });
        }
        created++;
      } else {
        // Refresh catalog facts, but never touch the image the admin may
        // have uploaded, and (by default) never touch live stock.
        const { slug: _slug, ...refresh } = rest;
        void _slug;
        await prisma.product.update({ where: { id: existing.id }, data: refresh });
        if (RESET_STOCK && existing.stock !== stock) {
          await prisma.$transaction([
            prisma.product.update({ where: { id: existing.id }, data: { stock } }),
            prisma.stockMovement.create({
              data: {
                productId: existing.id,
                previousStock: existing.stock,
                quantityChange: stock - existing.stock,
                newStock: stock,
                type: "MANUAL_ADJUSTMENT",
                userName: "Catalog import",
                note: "Stock reset from the previous POS export",
              },
            }),
          ]);
        }
        updated++;
      }
    }
    console.log(`Created ${created}, updated ${updated}.`);
  }

  if (REMOVE_DEMO) {
    const demo = await prisma.product.findMany({
      where: { imageUrl: { startsWith: "/products/" }, NOT: { imageUrl: PLACEHOLDER_IMAGE } },
      select: { id: true, name: true },
    });
    if (DRY_RUN) console.log(`Would remove ${demo.length} demo products.`);
    else {
      // Past order lines keep their snapshot (productId is set null on delete).
      await prisma.product.deleteMany({ where: { id: { in: demo.map((d) => d.id) } } });
      console.log(`Removed ${demo.length} demo products.`);
    }
  }

  const show = (label: string, list: string[]) => {
    if (list.length) console.log(`\n${label} (${list.length}):\n  - ${list.join("\n  - ")}`);
  };
  show("Imported as INACTIVE (hidden from the register)", notes.inactive);
  show("POS-only items (services/supplies, hidden from the website)", notes.posOnly);
  show("Stock clamped", notes.clamped);
  show("Barcode values skipped", notes.droppedBarcodes);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
