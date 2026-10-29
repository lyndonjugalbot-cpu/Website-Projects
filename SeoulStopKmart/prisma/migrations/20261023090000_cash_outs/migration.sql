-- CreateTable
CREATE TABLE "CashOut" (
    "id" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "cashierName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "payee" TEXT,
    "amountCentavos" INTEGER NOT NULL,
    "paidFrom" TEXT NOT NULL DEFAULT 'cash',
    "note" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedByName" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashOut_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashOut_cashierId_createdAt_idx" ON "CashOut"("cashierId", "createdAt");

-- CreateIndex
CREATE INDEX "CashOut_createdAt_idx" ON "CashOut"("createdAt");
