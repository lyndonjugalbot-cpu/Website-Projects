import type { Role } from "@prisma/client";

/**
 * Central capability map. Every server-side mutation must go through
 * `can()` rather than checking `role === "SUPER_ADMIN"` inline, so the
 * capability set stays auditable in one place.
 */
const ROLE_CAPABILITIES: Record<Role, string[]> = {
  BUYER: ["order.place", "review.write", "report.file", "message.send"],
  SELLER: [
    "order.place",
    "review.write",
    "report.file",
    "message.send",
    "listing.create",
    "listing.edit.own",
    "listing.delete.own",
    "order.fulfil.own",
  ],
  MODERATOR: [
    "listing.approve",
    "listing.edit.any",
    "listing.remove",
    "report.review",
    "user.warn",
    "review.moderate",
  ],
  VERIFICATION_REVIEWER: [
    "verification.review",
    "verification.viewDocuments",
  ],
  SUPPORT: [
    "order.view.any",
    "dispute.manage",
    "refund.approve",
    "message.moderate",
    "user.view.any",
  ],
  SUPER_ADMIN: [
    "*", // full access, still logged via AuditLog
  ],
};

export function can(role: Role, capability: string): boolean {
  const caps = ROLE_CAPABILITIES[role] ?? [];
  return caps.includes("*") || caps.includes(capability);
}

export function isStaff(role: Role) {
  return (
    role === "MODERATOR" ||
    role === "VERIFICATION_REVIEWER" ||
    role === "SUPPORT" ||
    role === "SUPER_ADMIN"
  );
}

export function isAdmin(role: Role) {
  return role === "SUPER_ADMIN";
}

/** Gates that must ALL be true before a user is allowed to create a listing. */
export function sellerEligibility(user: {
  isEmailVerified: boolean;
  isFacebookLinked: boolean;
  isIdVerified: boolean;
  sellerTermsAt: Date | null;
}) {
  return {
    emailVerified: user.isEmailVerified,
    facebookConnected: user.isFacebookLinked,
    idVerified: user.isIdVerified,
    sellerTermsAccepted: Boolean(user.sellerTermsAt),
    eligible:
      user.isEmailVerified &&
      user.isFacebookLinked &&
      user.isIdVerified &&
      Boolean(user.sellerTermsAt),
  };
}
