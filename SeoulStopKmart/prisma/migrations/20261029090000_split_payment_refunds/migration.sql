-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "gcashAmountCentavos" INTEGER,
ADD COLUMN     "refundedCentavos" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "refundedQuantity" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amountCentavos" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "refundedById" TEXT NOT NULL,
    "refundedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Refund_orderId_idx" ON "Refund"("orderId");

-- CreateIndex
CREATE INDEX "Refund_refundedById_createdAt_idx" ON "Refund"("refundedById", "createdAt");

-- CreateIndex
CREATE INDEX "Refund_createdAt_idx" ON "Refund"("createdAt");

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
