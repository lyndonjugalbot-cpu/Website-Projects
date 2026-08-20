import type {
  ListingCategory,
  ItemCondition,
  GradingCompany,
  CardLanguage,
  OrderStatus,
  PaymentStatus,
  PayoutStatus,
  DisputeStatus,
  PayoutAccountStatus,
  VerificationStatus,
} from "@prisma/client";

export const SITE_NAME = "Wots TCG Vault NZ";
export const SITE_DESCRIPTION =
  "New Zealand's premium marketplace for Pokémon cards, graded slabs, sealed product and TCG collectibles.";

export const CATEGORY_LABELS: Record<ListingCategory, string> = {
  SINGLE_CARD: "Single Cards",
  GRADED_SLAB: "Graded Slabs",
  SEALED_PRODUCT: "Sealed Products",
  BOOSTER_BOX: "Booster Boxes",
  BOOSTER_PACK: "Booster Packs",
  ELITE_TRAINER_BOX: "Elite Trainer Boxes",
  COLLECTION: "Collections",
  ACCESSORIES: "Accessories",
  OTHER: "Other",
};

export const CONDITION_LABELS: Record<ItemCondition, string> = {
  MINT: "Mint",
  NEAR_MINT: "Near Mint",
  EXCELLENT: "Excellent",
  GOOD: "Good",
  PLAYED: "Played",
  HEAVILY_PLAYED: "Heavily Played",
  DAMAGED: "Damaged",
};

export const GRADING_COMPANY_LABELS: Record<GradingCompany, string> = {
  PSA: "PSA",
  BGS: "BGS (Beckett)",
  CGC: "CGC",
  ACE: "ACE Grading",
  OTHER: "Other",
};

export const LANGUAGE_LABELS: Record<CardLanguage, string> = {
  ENGLISH: "English",
  JAPANESE: "Japanese",
  KOREAN: "Korean",
  CHINESE: "Chinese",
  GERMAN: "German",
  FRENCH: "French",
  ITALIAN: "Italian",
  SPANISH: "Spanish",
  OTHER: "Other",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Pending Payment",
  PAYMENT_PROCESSING: "Payment Processing",
  PAID: "Paid",
  AWAITING_SHIPMENT: "Awaiting Shipment",
  SHIPPED: "Shipped",
  IN_TRANSIT: "In Transit",
  DELIVERED: "Delivered",
  INSPECTION_PERIOD: "Buyer Protection Period",
  PAYOUT_ELIGIBLE: "Payout Eligible",
  PAYOUT_PENDING: "Payout Pending",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REFUND_PENDING: "Refund Pending",
  PARTIALLY_REFUNDED: "Partially Refunded",
  REFUNDED: "Refunded",
  DISPUTED: "Disputed",
  DELIVERY_FAILED: "Delivery Failed",
  ADMIN_REVIEW: "Admin Review",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  CREATED: "Created",
  REQUIRES_ACTION: "Requires Action",
  SUCCEEDED: "Succeeded",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially Refunded",
  DISPUTED: "Disputed",
  CHARGEBACK: "Chargeback",
};

export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  NOT_ELIGIBLE: "Not Eligible",
  ELIGIBLE: "Eligible",
  PENDING: "Pending",
  IN_TRANSIT: "In Transit",
  PAID: "Paid",
  FAILED: "Failed",
  ON_HOLD: "On Hold",
  REVERSED: "Reversed",
};

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  OPEN: "Open",
  SELLER_RESPONSE_REQUIRED: "Seller Response Required",
  UNDER_REVIEW: "Under Review",
  WAITING_FOR_EVIDENCE: "Waiting For Evidence",
  RESOLVED_BUYER: "Resolved — Buyer",
  RESOLVED_SELLER: "Resolved — Seller",
  PARTIAL_REFUND: "Partial Refund",
  CLOSED: "Closed",
};

export const PAYOUT_ACCOUNT_STATUS_LABELS: Record<PayoutAccountStatus, string> = {
  NOT_STARTED: "Not Started",
  ONBOARDING_INCOMPLETE: "Onboarding Incomplete",
  VERIFICATION_PENDING: "Verification Pending",
  ENABLED: "Enabled",
  RESTRICTED: "Restricted",
  DISABLED: "Disabled",
};

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  PENDING: "Pending Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  RESUBMISSION_REQUESTED: "Resubmission Requested",
};

export const DEFECT_FIELDS: { key: string; label: string }[] = [
  { key: "defectWhiteningBack", label: "Whitening on the back" },
  { key: "defectWhiteningCorners", label: "Whitening on corners" },
  { key: "defectScratches", label: "Scratches" },
  { key: "defectDents", label: "Dents" },
  { key: "defectCreases", label: "Creases" },
  { key: "defectSurfaceDamage", label: "Surface damage" },
  { key: "defectPrintLines", label: "Print lines" },
  { key: "defectEdgeWear", label: "Edge wear" },
  { key: "defectBends", label: "Bends" },
  { key: "defectWaterDamage", label: "Water damage" },
];

export const NZ_REGIONS = [
  "Northland",
  "Auckland",
  "Waikato",
  "Bay of Plenty",
  "Gisborne",
  "Hawke's Bay",
  "Taranaki",
  "Manawatū-Whanganui",
  "Wellington",
  "Tasman",
  "Nelson",
  "Marlborough",
  "West Coast",
  "Canterbury",
  "Otago",
  "Southland",
];

// Platform commission/fee/payout-timing settings moved to
// lib/platform-settings.ts (admin-configurable, DB-backed) and the fee
// math itself to lib/money.ts (integer-cents only). This file keeps
// display-only label maps.
