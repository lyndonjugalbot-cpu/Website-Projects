-- CreateEnum
CREATE TYPE "PayoutAccountStatus" AS ENUM ('NOT_STARTED', 'ONBOARDING_INCOMPLETE', 'VERIFICATION_PENDING', 'ENABLED', 'RESTRICTED', 'DISABLED');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'PAID', 'REVERSED', 'PARTIALLY_REVERSED', 'FAILED');

-- CreateEnum
CREATE TYPE "RefundType" AS ENUM ('FULL', 'PARTIAL', 'SHIPPING_ONLY');

-- CreateEnum
CREATE TYPE "DisputeSource" AS ENUM ('BUYER', 'STRIPE_CHARGEBACK');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DisputeStatus" ADD VALUE 'SELLER_RESPONSE_REQUIRED';
ALTER TYPE "DisputeStatus" ADD VALUE 'WAITING_FOR_EVIDENCE';
ALTER TYPE "DisputeStatus" ADD VALUE 'PARTIAL_REFUND';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'DISPUTE';
ALTER TYPE "NotificationType" ADD VALUE 'STRIPE_ACCOUNT';

-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('PENDING_PAYMENT', 'PAYMENT_PROCESSING', 'PAID', 'AWAITING_SHIPMENT', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'INSPECTION_PERIOD', 'PAYOUT_ELIGIBLE', 'PAYOUT_PENDING', 'COMPLETED', 'CANCELLED', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED', 'DISPUTED', 'DELIVERY_FAILED', 'ADMIN_REVIEW');
ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "OrderStatus_old";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentStatus_new" AS ENUM ('CREATED', 'REQUIRES_ACTION', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'DISPUTED', 'CHARGEBACK');
ALTER TABLE "Payment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Payment" ALTER COLUMN "status" TYPE "PaymentStatus_new" USING ("status"::text::"PaymentStatus_new");
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "PaymentStatus_old";
ALTER TABLE "Payment" ALTER COLUMN "status" SET DEFAULT 'CREATED';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PayoutStatus_new" AS ENUM ('NOT_ELIGIBLE', 'ELIGIBLE', 'PENDING', 'IN_TRANSIT', 'PAID', 'FAILED', 'ON_HOLD', 'REVERSED');
ALTER TABLE "Payout" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Payout" ALTER COLUMN "status" TYPE "PayoutStatus_new" USING ("status"::text::"PayoutStatus_new");
ALTER TYPE "PayoutStatus" RENAME TO "PayoutStatus_old";
ALTER TYPE "PayoutStatus_new" RENAME TO "PayoutStatus";
DROP TYPE "PayoutStatus_old";
ALTER TABLE "Payout" ALTER COLUMN "status" SET DEFAULT 'NOT_ELIGIBLE';
COMMIT;

-- AlterEnum
ALTER TYPE "RefundStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "Dispute" ADD COLUMN     "evidenceDueBy" TIMESTAMP(3),
ADD COLUMN     "internalNotes" TEXT,
ADD COLUMN     "payoutOnHold" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "refundDecisionCents" INTEGER,
ADD COLUMN     "sellerRespondedAt" TIMESTAMP(3),
ADD COLUMN     "sellerResponse" TEXT,
ADD COLUMN     "source" "DisputeSource" NOT NULL DEFAULT 'BUYER',
ADD COLUMN     "stripeDisputeId" TEXT;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "reservedQuantity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "adminReviewNote" TEXT,
ADD COLUMN     "deliveryFailedAt" TIMESTAMP(3),
ADD COLUMN     "inspectionEndAt" TIMESTAMP(3),
ADD COLUMN     "inspectionStartAt" TIMESTAMP(3),
ADD COLUMN     "payoutEligibleAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "refundedAmountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stripeCheckoutSessionId" TEXT,
ALTER COLUMN "status" SET DEFAULT 'CREATED';

-- AlterTable
ALTER TABLE "Payout" DROP COLUMN "stripeTransferId",
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "releasedManuallyBy" TEXT,
ALTER COLUMN "status" SET DEFAULT 'NOT_ELIGIBLE';

-- AlterTable
ALTER TABLE "Refund" ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "platformFeeRefundCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reversedTransferId" TEXT,
ADD COLUMN     "type" "RefundType" NOT NULL DEFAULT 'FULL';

-- AlterTable
ALTER TABLE "SellerPayoutAccount" ADD COLUMN     "chargesEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "disabledReason" TEXT,
ADD COLUMN     "requirementsCurrentlyDue" TEXT[],
ADD COLUMN     "requirementsPastDue" TEXT[],
ADD COLUMN     "status" "PayoutAccountStatus" NOT NULL DEFAULT 'NOT_STARTED';

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "payoutId" TEXT,
    "stripeTransferId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "reversedCents" INTEGER NOT NULL DEFAULT 0,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisputeEvidence" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisputeEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingReservation" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "orderId" TEXT,
    "buyerId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_payoutId_key" ON "Transfer"("payoutId");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_stripeTransferId_key" ON "Transfer"("stripeTransferId");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_idempotencyKey_key" ON "Transfer"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Transfer_orderId_idx" ON "Transfer"("orderId");

-- CreateIndex
CREATE INDEX "Transfer_sellerId_idx" ON "Transfer"("sellerId");

-- CreateIndex
CREATE INDEX "DisputeEvidence_disputeId_idx" ON "DisputeEvidence"("disputeId");

-- CreateIndex
CREATE UNIQUE INDEX "ListingReservation_orderId_key" ON "ListingReservation"("orderId");

-- CreateIndex
CREATE INDEX "ListingReservation_listingId_status_idx" ON "ListingReservation"("listingId", "status");

-- CreateIndex
CREATE INDEX "ListingReservation_status_expiresAt_idx" ON "ListingReservation"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_type_idx" ON "WebhookEvent"("type");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_idx" ON "WebhookEvent"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_stripeDisputeId_key" ON "Dispute"("stripeDisputeId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripeCheckoutSessionId_key" ON "Payment"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_idempotencyKey_key" ON "Payout"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_stripeRefundId_key" ON "Refund"("stripeRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_idempotencyKey_key" ON "Refund"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeEvidence" ADD CONSTRAINT "DisputeEvidence_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingReservation" ADD CONSTRAINT "ListingReservation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingReservation" ADD CONSTRAINT "ListingReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

