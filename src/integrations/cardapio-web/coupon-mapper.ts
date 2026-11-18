import {
  normalizeCouponCode,
  type BenefitType,
  type Offer,
  type OrderChannel,
} from "@/domain/offer/offer";
import type { CwCouponInput, CwCouponType, CwOrderType } from "./coupons";

const COUPON_TYPE: Record<BenefitType, CwCouponType> = {
  fixed_amount: "flat_discount",
  percentage: "percent_discount",
  free_shipping: "free_shipping",
};

const ORDER_TYPE: Record<OrderChannel, CwOrderType> = {
  delivery: "delivery",
  takeout: "takeout",
  dine_in: "onsite",
};

/** Maps a domain offer to the CW coupon payload. Coupons are always created inactive. */
export function toCwCouponInput(offer: Offer, campaignName: string): CwCouponInput {
  const minimumOrderValue = offer.minimumOrderValue ?? 0;
  return {
    name: campaignName,
    type: COUPON_TYPE[offer.benefit],
    value: offer.benefit === "free_shipping" ? null : offer.amount,
    code: normalizeCouponCode(offer.couponCode),
    active: false,
    minimum_order_value: minimumOrderValue > 0 ? minimumOrderValue : null,
    use_limit: offer.usageLimit,
    new_customers_only: offer.newCustomersOnly,
    customer_multi_use: !offer.oncePerCustomer,
    available_order_types: offer.channels.map((channel) => ORDER_TYPE[channel]),
    available_from: offer.startsOn,
    expires_at: offer.endsOn,
  };
}
