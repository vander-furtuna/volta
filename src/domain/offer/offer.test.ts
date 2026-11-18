import { describe, expect, it } from "vitest";
import {
  canProceedToReview,
  discountExposure,
  normalizeCouponCode,
  validateOffer,
  type Offer,
} from "./offer";

const context = { audienceAverageOrderValue: 74, averageDeliveryFee: 7 };

const baseOffer: Offer = {
  benefit: "fixed_amount",
  amount: 10,
  minimumOrderValue: 60,
  usageLimit: 20,
  oncePerCustomer: true,
  newCustomersOnly: false,
  couponCode: "VOLTA10",
  channels: ["delivery", "takeout"],
  startsOn: "2026-11-18",
  endsOn: "2026-11-23",
};

const issueCodes = (offer: Offer) => validateOffer(offer, context).map((issue) => issue.code);

describe("discountExposure", () => {
  it("is exact for a fixed amount: amount × usage limit", () => {
    expect(discountExposure(baseOffer, context)).toEqual({
      amount: 200,
      isExact: true,
      basis: { perUse: 10, uses: 20 },
    });
  });

  it("estimates a percentage from the audience average order", () => {
    const exposure = discountExposure({ ...baseOffer, benefit: "percentage", amount: 15 }, context);
    expect(exposure.amount).toBeCloseTo(222);
    expect(exposure.isExact).toBe(false);
  });

  it("estimates free shipping from the average delivery fee", () => {
    const exposure = discountExposure(
      { ...baseOffer, benefit: "free_shipping", amount: null },
      context,
    );
    expect(exposure.amount).toBe(140);
  });
});

describe("validateOffer", () => {
  it("accepts the default repurchase offer", () => {
    expect(validateOffer(baseOffer, context)).toEqual([]);
    expect(canProceedToReview(baseOffer, context)).toBe(true);
  });

  it("blocks new-customers-only, which would exclude the whole audience", () => {
    expect(issueCodes({ ...baseOffer, newCustomersOnly: true })).toContain(
      "new_customers_only_blocks_audience",
    );
    expect(canProceedToReview({ ...baseOffer, newCustomersOnly: true }, context)).toBe(false);
  });

  it("blocks a coupon without code, which would be visible to every customer", () => {
    expect(issueCodes({ ...baseOffer, couponCode: "  " })).toContain("missing_coupon_code");
  });

  it("blocks free shipping without delivery", () => {
    const offer: Offer = {
      ...baseOffer,
      benefit: "free_shipping",
      amount: null,
      channels: ["takeout"],
    };
    expect(issueCodes(offer)).toContain("free_shipping_without_delivery");
  });

  it("blocks percentages above 100 and an end date before the start", () => {
    expect(issueCodes({ ...baseOffer, benefit: "percentage", amount: 120 })).toContain(
      "invalid_amount",
    );
    expect(issueCodes({ ...baseOffer, endsOn: "2026-11-10" })).toContain("invalid_period");
  });

  it("only warns about a high minimum order or multiple uses", () => {
    const offer = { ...baseOffer, minimumOrderValue: 90, oncePerCustomer: false };
    expect(issueCodes(offer)).toEqual([
      "minimum_above_average_order",
      "multiple_uses_per_customer",
    ]);
    expect(canProceedToReview(offer, context)).toBe(true);
  });
});

describe("normalizeCouponCode", () => {
  it("uppercases and strips whitespace", () => {
    expect(normalizeCouponCode(" volta 10 ")).toBe("VOLTA10");
    expect(normalizeCouponCode("")).toBeNull();
  });
});
