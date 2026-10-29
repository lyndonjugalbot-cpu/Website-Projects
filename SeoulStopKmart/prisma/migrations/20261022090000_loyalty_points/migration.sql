-- CreateEnum
CREATE TYPE "PointsTransactionType" AS ENUM ('EARN', 'REDEEM', 'ADJUST', 'VOID_EARN', 'VOID_REDEEM');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "pointsBalanceAfter" INTEGER,
ADD COLUMN     "pointsDiscountCentavos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pointsEarned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pointsRedeemed" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "lifetimePoints" INTEGER NOT NULL DEFAULT 0,
    "failedPinAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointsTransaction" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "PointsTransactionType" NOT NULL,
    "points" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "orderId" TEXT,
    "note" TEXT,
    "userName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointsTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "PointsTransaction_customerId_createdAt_idx" ON "PointsTransaction"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "PointsTransaction_orderId_idx" ON "PointsTransaction"("orderId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsTransaction" ADD CONSTRAINT "PointsTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsTransaction" ADD CONSTRAINT "PointsTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
