import { describe, expect, it } from "vitest";
import type { Offer } from "@/domain/offer/offer";
import { toCwCouponInput } from "./coupon-mapper";

const offer: Offer = {
  benefit: "fixed_amount",
  amount: 10,
  minimumOrderValue: 60,
  usageLimit: 20,
  oncePerCustomer: true,
  newCustomersOnly: false,
  couponCode: "volta10",
  channels: ["delivery", "takeout", "dine_in"],
  startsOn: "2026-11-18",
  endsOn: "2026-11-23",
};

describe("toCwCouponInput", () => {
  it("creates an inactive coupon with CW field names", () => {
    expect(toCwCouponInput(offer, "Volta de novembro")).toEqual({
      name: "Volta de novembro",
      type: "flat_discount",
      value: 10,
      code: "VOLTA10",
      active: false,
      minimum_order_value: 60,
      use_limit: 20,
      new_customers_only: false,
      customer_multi_use: false,
      available_order_types: ["delivery", "takeout", "onsite"],
      available_from: "2026-11-18",
      expires_at: "2026-11-23",
    });
  });

  it("sends a null value for free shipping", () => {
    expect(toCwCouponInput({ ...offer, benefit: "free_shipping" }, "Frete").value).toBeNull();
  });
});
