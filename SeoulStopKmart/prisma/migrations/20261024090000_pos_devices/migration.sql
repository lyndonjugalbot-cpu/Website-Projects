-- CreateTable
CREATE TABLE "PosDevice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "approvedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "PosDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PosDevice_tokenHash_key" ON "PosDevice"("tokenHash");
