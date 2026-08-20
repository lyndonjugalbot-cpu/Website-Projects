import { BadgeCheck, Facebook, Mail, ShieldCheck, Gem } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  CONDITION_LABELS,
  GRADING_COMPANY_LABELS,
  ORDER_STATUS_LABELS,
  PAYOUT_STATUS_LABELS,
  DISPUTE_STATUS_LABELS,
  PAYOUT_ACCOUNT_STATUS_LABELS,
} from "@/lib/constants";
import type { ItemCondition, GradingCompany, OrderStatus, PayoutStatus, DisputeStatus, PayoutAccountStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "default" | "outline";

const ORDER_STATUS_TONE: Record<OrderStatus, Tone> = {
  PENDING_PAYMENT: "warning",
  PAYMENT_PROCESSING: "warning",
  PAID: "default",
  AWAITING_SHIPMENT: "warning",
  SHIPPED: "default",
  IN_TRANSIT: "default",
  DELIVERED: "success",
  INSPECTION_PERIOD: "success",
  PAYOUT_ELIGIBLE: "success",
  PAYOUT_PENDING: "default",
  COMPLETED: "success",
  CANCELLED: "outline",
  REFUND_PENDING: "warning",
  PARTIALLY_REFUNDED: "warning",
  REFUNDED: "danger",
  DISPUTED: "danger",
  DELIVERY_FAILED: "danger",
  ADMIN_REVIEW: "danger",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={ORDER_STATUS_TONE[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}

const PAYOUT_STATUS_TONE: Record<PayoutStatus, Tone> = {
  NOT_ELIGIBLE: "outline",
  ELIGIBLE: "warning",
  PENDING: "warning",
  IN_TRANSIT: "default",
  PAID: "success",
  FAILED: "danger",
  ON_HOLD: "danger",
  REVERSED: "danger",
};

export function PayoutStatusBadge({ status }: { status: PayoutStatus }) {
  return <Badge variant={PAYOUT_STATUS_TONE[status]}>{PAYOUT_STATUS_LABELS[status]}</Badge>;
}

const DISPUTE_STATUS_TONE: Record<DisputeStatus, Tone> = {
  OPEN: "warning",
  SELLER_RESPONSE_REQUIRED: "warning",
  UNDER_REVIEW: "warning",
  WAITING_FOR_EVIDENCE: "warning",
  RESOLVED_BUYER: "success",
  RESOLVED_SELLER: "success",
  PARTIAL_REFUND: "success",
  CLOSED: "outline",
};

export function DisputeStatusBadge({ status }: { status: DisputeStatus }) {
  return <Badge variant={DISPUTE_STATUS_TONE[status]}>{DISPUTE_STATUS_LABELS[status]}</Badge>;
}

const PAYOUT_ACCOUNT_STATUS_TONE: Record<PayoutAccountStatus, Tone> = {
  NOT_STARTED: "outline",
  ONBOARDING_INCOMPLETE: "warning",
  VERIFICATION_PENDING: "warning",
  ENABLED: "success",
  RESTRICTED: "danger",
  DISABLED: "danger",
};

export function PayoutAccountStatusBadge({ status }: { status: PayoutAccountStatus }) {
  return <Badge variant={PAYOUT_ACCOUNT_STATUS_TONE[status]}>{PAYOUT_ACCOUNT_STATUS_LABELS[status]}</Badge>;
}

export function ConditionBadge({ condition }: { condition: ItemCondition }) {
  const tone =
    condition === "MINT" || condition === "NEAR_MINT"
      ? "success"
      : condition === "DAMAGED" || condition === "HEAVILY_PLAYED"
        ? "danger"
        : "warning";
  return <Badge variant={tone as "success" | "danger" | "warning"}>{CONDITION_LABELS[condition]}</Badge>;
}

export function GradingBadge({ company, grade }: { company: GradingCompany; grade?: string | null }) {
  return (
    <Badge variant="solid" className="gap-1">
      <Gem className="h-3 w-3" />
      {GRADING_COMPANY_LABELS[company]} {grade ? grade : ""}
    </Badge>
  );
}

export function VerificationBadges({
  emailVerified,
  facebookLinked,
  idVerified,
  trustedSeller,
  size = "sm",
}: {
  emailVerified?: boolean;
  facebookLinked?: boolean;
  idVerified?: boolean;
  trustedSeller?: boolean;
  size?: "sm" | "md";
}) {
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {trustedSeller && (
        <span
          title="Trusted Seller"
          className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px] text-gold-light"
        >
          <ShieldCheck className={iconSize} /> Trusted Seller
        </span>
      )}
      {idVerified && (
        <span
          title="ID Verified"
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] text-success"
          )}
        >
          <BadgeCheck className={iconSize} /> ID Verified
        </span>
      )}
      {emailVerified && (
        <span
          title="Email Verified"
          className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-muted"
        >
          <Mail className={iconSize} /> Email
        </span>
      )}
      {facebookLinked && (
        <span
          title="Facebook Connected"
          className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-muted"
        >
          <Facebook className={iconSize} /> Facebook
        </span>
      )}
    </div>
  );
}
