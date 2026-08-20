import { describe, it, expect } from "vitest";
import { calculateFeeBreakdown, calculateRefundSplit, bpsOf } from "@/lib/money";

describe("bpsOf", () => {
  it("computes basis points as an integer number of cents", () => {
    expect(bpsOf(10000, 800)).toBe(800); // 8% of $100.00 = $8.00
  });

  it("rounds to the nearest cent rather than truncating", () => {
    // 333 bps of 101 cents = 3.3633 -> rounds to 3
    expect(bpsOf(101, 333)).toBe(3);
  });

  it("never returns a non-integer", () => {
    const result = bpsOf(9999, 137);
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe("calculateFeeBreakdown", () => {
  const base = {
    subtotalCents: 10_000, // $100.00
    shippingCents: 1_000, // $10.00
    platformCommissionBps: 800, // 8%
    platformFixedFeeCents: 0,
    buyerPaysFees: false,
    buyerFeeBps: 290,
    reserveBps: 500, // 5%
  };

  it("charges the buyer exactly subtotal + shipping when buyer fees are disabled", () => {
    const b = calculateFeeBreakdown(base);
    expect(b.buyerFeeCents).toBe(0);
    expect(b.totalCents).toBe(11_000);
  });

  it("adds a buyer fee line when buyerPaysFees is enabled, without changing the seller's net", () => {
    const withFee = calculateFeeBreakdown({ ...base, buyerPaysFees: true });
    const withoutFee = calculateFeeBreakdown(base);
    expect(withFee.buyerFeeCents).toBeGreaterThan(0);
    expect(withFee.totalCents).toBe(11_000 + withFee.buyerFeeCents);
    expect(withFee.sellerNetCents).toBe(withoutFee.sellerNetCents);
  });

  it("deducts platform commission from the item subtotal only, not shipping", () => {
    const b = calculateFeeBreakdown(base);
    expect(b.platformCommissionCents).toBe(800); // 8% of $100 subtotal, not $110 total
  });

  it("withholds the reserve from gross seller proceeds after the platform fee", () => {
    const b = calculateFeeBreakdown(base);
    const grossSeller = base.subtotalCents + base.shippingCents - b.platformCommissionCents;
    expect(b.reserveCents).toBe(Math.round(grossSeller * 0.05));
    expect(b.sellerNetCents).toBe(grossSeller - b.reserveCents);
  });

  it("never produces a negative seller net even with an aggressive fee configuration", () => {
    const b = calculateFeeBreakdown({
      ...base,
      subtotalCents: 100,
      shippingCents: 0,
      platformCommissionBps: 3000,
      platformFixedFeeCents: 500,
    });
    expect(b.sellerNetCents).toBeGreaterThanOrEqual(0);
  });

  it("only ever returns integer cent amounts", () => {
    const b = calculateFeeBreakdown({ ...base, subtotalCents: 3333, shippingCents: 777 });
    for (const value of Object.values(b)) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});

describe("calculateRefundSplit", () => {
  it("prorates the platform fee refund proportionally to the refund amount", () => {
    const split = calculateRefundSplit({
      refundAmountCents: 5_000, // refunding half of a $100 order
      orderSubtotalCents: 10_000,
      orderShippingCents: 0,
      platformCommissionCents: 800,
    });
    expect(split.platformFeeRefundCents).toBe(400); // half of the $8 commission
    expect(split.sellerDeductionCents).toBe(4_600);
  });

  it("refunds 100% of the platform fee on a full refund", () => {
    const split = calculateRefundSplit({
      refundAmountCents: 11_000,
      orderSubtotalCents: 10_000,
      orderShippingCents: 1_000,
      platformCommissionCents: 800,
    });
    expect(split.platformFeeRefundCents).toBe(800);
  });

  it("never divides by zero on a malformed zero-total order", () => {
    const split = calculateRefundSplit({
      refundAmountCents: 100,
      orderSubtotalCents: 0,
      orderShippingCents: 0,
      platformCommissionCents: 0,
    });
    expect(split.platformFeeRefundCents).toBe(0);
    expect(split.sellerDeductionCents).toBe(100);
  });
});
