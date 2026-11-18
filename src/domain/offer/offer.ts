/**
 * Offer rules for the "Oferta e limites" screen.
 * Same behavior as design/templates/source/offer.dc.html, now pure and testable.
 * Returns issue codes; user-facing text lives in src/copy.
 */

export type BenefitType = "fixed_amount" | "percentage" | "free_shipping";
export type OrderChannel = "delivery" | "takeout" | "dine_in";

export interface Offer {
  benefit: BenefitType;
  /** BRL for fixed_amount, percent for percentage, ignored for free_shipping */
  amount: number | null;
  minimumOrderValue: number | null;
  usageLimit: number;
  oncePerCustomer: boolean;
  newCustomersOnly: boolean;
  couponCode: string | null;
  channels: OrderChannel[];
  /** ISO date (YYYY-MM-DD) */
  startsOn: string;
  /** ISO date (YYYY-MM-DD), valid until 23:59 */
  endsOn: string;
}

export interface OfferContext {
  /** Average order value of the frozen audience, in BRL */
  audienceAverageOrderValue: number;
  /** Store's average delivery fee, in BRL */
  averageDeliveryFee: number;
}

export interface DiscountExposure {
  amount: number;
  /** true when the ceiling is exact (fixed amount); false when it is an estimate */
  isExact: boolean;
  /** Inputs used, so the UI can explain the number */
  basis: { perUse: number; uses: number };
}

export type OfferIssueCode =
  | "new_customers_only_blocks_audience"
  | "missing_coupon_code"
  | "invalid_usage_limit"
  | "invalid_amount"
  | "free_shipping_without_delivery"
  | "invalid_period"
  | "minimum_above_average_order"
  | "multiple_uses_per_customer";

export type IssueSeverity = "blocking" | "warning";

export interface OfferIssue {
  code: OfferIssueCode;
  severity: IssueSeverity;
}

const MAX_PERCENTAGE = 100;

export function normalizeCouponCode(code: string | null): string | null {
  const cleaned = (code ?? "").replace(/\s/g, "").toUpperCase();
  return cleaned === "" ? null : cleaned;
}

function perUseCost(offer: Offer, context: OfferContext): number {
  const amount = Math.max(0, offer.amount ?? 0);
  switch (offer.benefit) {
    case "fixed_amount":
      return amount;
    case "percentage":
      return (amount / MAX_PERCENTAGE) * context.audienceAverageOrderValue;
    case "free_shipping":
      return context.averageDeliveryFee;
  }
}

/** Maximum nominal discount the coupon can grant. Excludes messaging, food cost and other promotions. */
export function discountExposure(offer: Offer, context: OfferContext): DiscountExposure {
  const uses = Math.max(0, Math.trunc(offer.usageLimit));
  const perUse = perUseCost(offer, context);
  return {
    amount: perUse * uses,
    isExact: offer.benefit === "fixed_amount",
    basis: { perUse, uses },
  };
}

function isValidAmount(offer: Offer): boolean {
  const amount = offer.amount ?? 0;
  if (offer.benefit === "fixed_amount") return amount > 0;
  if (offer.benefit === "percentage") return amount > 0 && amount <= MAX_PERCENTAGE;
  return true;
}

export function validateOffer(offer: Offer, context: OfferContext): OfferIssue[] {
  const checks: [boolean, OfferIssueCode, IssueSeverity][] = [
    [offer.newCustomersOnly, "new_customers_only_blocks_audience", "blocking"],
    [normalizeCouponCode(offer.couponCode) === null, "missing_coupon_code", "blocking"],
    [
      !Number.isInteger(offer.usageLimit) || offer.usageLimit <= 0,
      "invalid_usage_limit",
      "blocking",
    ],
    [!isValidAmount(offer), "invalid_amount", "blocking"],
    [
      offer.benefit === "free_shipping" && !offer.channels.includes("delivery"),
      "free_shipping_without_delivery",
      "blocking",
    ],
    [
      !offer.startsOn || !offer.endsOn || offer.endsOn < offer.startsOn,
      "invalid_period",
      "blocking",
    ],
    [
      (offer.minimumOrderValue ?? 0) > context.audienceAverageOrderValue,
      "minimum_above_average_order",
      "warning",
    ],
    [!offer.oncePerCustomer, "multiple_uses_per_customer", "warning"],
  ];
  return checks.filter(([failed]) => failed).map(([, code, severity]) => ({ code, severity }));
}

export function canProceedToReview(offer: Offer, context: OfferContext): boolean {
  return validateOffer(offer, context).every((issue) => issue.severity !== "blocking");
}
