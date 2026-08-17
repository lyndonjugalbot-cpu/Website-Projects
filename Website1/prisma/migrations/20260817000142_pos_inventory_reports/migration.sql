-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "unitCostCentavos" INTEGER;

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "previousStock" INTEGER NOT NULL,
    "quantityChange" INTEGER NOT NULL,
    "newStock" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "orderId" TEXT,
    "userName" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "category" TEXT NOT NULL,
    "amountCentavos" INTEGER NOT NULL,
    "note" TEXT,
    "createdByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channel" TEXT NOT NULL DEFAULT 'ONLINE',
    "customerName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "addressLine" TEXT,
    "barangay" TEXT,
    "city" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "deliveryNotes" TEXT,
    "subtotalCentavos" INTEGER NOT NULL,
    "deliveryFeeCentavos" INTEGER NOT NULL DEFAULT 0,
    "discountCentavos" INTEGER NOT NULL DEFAULT 0,
    "totalCentavos" INTEGER NOT NULL,
    "orderStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentIntentId" TEXT,
    "paymentMethod" TEXT,
    "isMockPayment" BOOLEAN NOT NULL DEFAULT false,
    "cashierId" TEXT,
    "cashierName" TEXT,
    "cashReceivedCentavos" INTEGER,
    "changeGivenCentavos" INTEGER,
    "voidedAt" DATETIME,
    "voidedByName" TEXT,
    "voidReason" TEXT,
    "internalNotes" TEXT,
    "lastUpdatedByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Order" ("addressLine", "barangay", "city", "createdAt", "customerName", "deliveryFeeCentavos", "deliveryNotes", "discountCentavos", "email", "id", "internalNotes", "isMockPayment", "lastUpdatedByName", "orderStatus", "paymentIntentId", "paymentMethod", "paymentStatus", "phone", "postalCode", "province", "subtotalCentavos", "totalCentavos", "updatedAt") SELECT "addressLine", "barangay", "city", "createdAt", "customerName", "deliveryFeeCentavos", "deliveryNotes", "discountCentavos", "email", "id", "internalNotes", "isMockPayment", "lastUpdatedByName", "orderStatus", "paymentIntentId", "paymentMethod", "paymentStatus", "phone", "postalCode", "province", "subtotalCentavos", "totalCentavos", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_paymentIntentId_key" ON "Order"("paymentIntentId");
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceCentavos" INTEGER NOT NULL,
    "salePriceCentavos" INTEGER,
    "costCentavos" INTEGER,
    "supplier" TEXT,
    "barcode" TEXT,
    "imageUrl" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "allowOversell" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isBestSeller" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Product" ("category", "createdAt", "description", "id", "imageUrl", "isBestSeller", "isFeatured", "name", "priceCentavos", "salePriceCentavos", "slug", "status", "stock", "updatedAt") SELECT "category", "createdAt", "description", "id", "imageUrl", "isBestSeller", "isFeatured", "name", "priceCentavos", "salePriceCentavos", "slug", "status", "stock", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "StockMovement_productId_idx" ON "StockMovement"("productId");

-- CreateIndex
CREATE INDEX "StockMovement_orderId_idx" ON "StockMovement"("orderId");
