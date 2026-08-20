import { describe, it, expect } from "vitest";
import { can, isStaff, isAdmin, sellerEligibility } from "@/lib/rbac";

describe("can()", () => {
  it("grants SUPER_ADMIN every capability via the wildcard", () => {
    expect(can("SUPER_ADMIN", "payout.release")).toBe(true);
    expect(can("SUPER_ADMIN", "anything.at.all")).toBe(true);
  });

  it("does not grant payout release to SUPPORT — only SUPER_ADMIN", () => {
    expect(can("SUPPORT", "payout.release")).toBe(false);
    expect(can("SUPPORT", "refund.approve")).toBe(true);
  });

  it("does not grant a BUYER seller-only or staff-only capabilities", () => {
    expect(can("BUYER", "listing.create")).toBe(false);
    expect(can("BUYER", "verification.review")).toBe(false);
    expect(can("BUYER", "dispute.manage")).toBe(false);
  });

  it("scopes VERIFICATION_REVIEWER to verification only, not disputes or refunds", () => {
    expect(can("VERIFICATION_REVIEWER", "verification.review")).toBe(true);
    expect(can("VERIFICATION_REVIEWER", "dispute.manage")).toBe(false);
    expect(can("VERIFICATION_REVIEWER", "refund.approve")).toBe(false);
  });
});

describe("isStaff() / isAdmin()", () => {
  it("treats BUYER and SELLER as non-staff", () => {
    expect(isStaff("BUYER")).toBe(false);
    expect(isStaff("SELLER")).toBe(false);
  });

  it("treats all four admin-side roles as staff", () => {
    for (const role of ["MODERATOR", "VERIFICATION_REVIEWER", "SUPPORT", "SUPER_ADMIN"] as const) {
      expect(isStaff(role)).toBe(true);
    }
  });

  it("only SUPER_ADMIN is an admin", () => {
    expect(isAdmin("SUPER_ADMIN")).toBe(true);
    expect(isAdmin("SUPPORT")).toBe(false);
  });
});

describe("sellerEligibility()", () => {
  it("requires all four gates before allowing listing creation", () => {
    const result = sellerEligibility({
      isEmailVerified: true,
      isFacebookLinked: true,
      isIdVerified: false,
      sellerTermsAt: new Date(),
    });
    expect(result.eligible).toBe(false);
    expect(result.idVerified).toBe(false);
  });

  it("is eligible only once every gate is true", () => {
    const result = sellerEligibility({
      isEmailVerified: true,
      isFacebookLinked: true,
      isIdVerified: true,
      sellerTermsAt: new Date(),
    });
    expect(result.eligible).toBe(true);
  });

  it("treats a null sellerTermsAt as not accepted", () => {
    const result = sellerEligibility({
      isEmailVerified: true,
      isFacebookLinked: true,
      isIdVerified: true,
      sellerTermsAt: null,
    });
    expect(result.sellerTermsAccepted).toBe(false);
    expect(result.eligible).toBe(false);
  });
});
