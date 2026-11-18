import { z } from "zod";
import { CW_PAGE_SIZE } from "./config";
import type { CwClient } from "./http-client";

/**
 * CW coupons API.
 * - Create: POST /api/partner/v1/merchant/coupons
 * - Update: PUT  /api/partner/v1/merchant/coupons/{id} — full body; name, type and value are required
 * - List:   GET  /api/partner/v1/merchant/coupons — pagination only (max 20 per page), no code filter
 * The list has no usage counter: usage is counted from order discounts (coupon_id).
 * Source: https://docs.cardapioweb.com/api-reference/loja/cupons/ (schemas in generated/store.ts)
 */

const COUPONS_PATH = "/api/partner/v1/merchant/coupons";

const couponTypeSchema = z.enum(["flat_discount", "percent_discount", "free_shipping"]);
const orderTypeSchema = z.enum(["delivery", "takeout", "onsite"]);
export type CwCouponType = z.infer<typeof couponTypeSchema>;
export type CwOrderType = z.infer<typeof orderTypeSchema>;
export type CwWeekday =
  "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

/** Body sent to CW when creating or updating a coupon. */
export interface CwCouponInput {
  name: string;
  type: CwCouponType;
  /** null for free_shipping; >0 and ≤100 for percent_discount; >0 for flat_discount */
  value: number | null;
  /** null makes the coupon visible to every customer on the menu */
  code: string | null;
  active: boolean;
  minimum_order_value: number | null;
  use_limit: number | null;
  new_customers_only: boolean;
  customer_multi_use: boolean;
  availability_start_time?: string | null;
  availability_end_time?: string | null;
  available_days?: CwWeekday[];
  available_order_types: CwOrderType[];
  /** YYYY-MM-DD */
  available_from: string;
  /** YYYY-MM-DD; the coupon expires at 23:59 on this day */
  expires_at: string;
  item_ids?: number[];
}

export const cwCouponStatusSchema = z.enum([
  "not_active",
  "not_yet_available",
  "expired",
  "usage_limit_reached",
  "not_available",
  "valid",
]);

/** Coupon as returned by CW. Only the fields Volta relies on are required. */
export const cwCouponSchema = z.looseObject({
  id: z.number().int().positive(),
  uid: z.string(),
  code: z.string().nullable(),
  name: z.string(),
  type: couponTypeSchema,
  value: z.number().nullable(),
  active: z.boolean(),
  status: cwCouponStatusSchema,
  minimum_order_value: z.number().nullable(),
  use_limit: z.number().nullable(),
  new_customers_only: z.boolean(),
  customer_multi_use: z.boolean(),
  available_from: z.string().nullable(),
  expires_at: z.string().nullable(),
  available_order_types: z.array(orderTypeSchema).optional(),
});

export type CwCoupon = z.infer<typeof cwCouponSchema>;

const couponPageSchema = z.object({
  coupons: z.array(cwCouponSchema),
  pagination: z.object({
    current_page: z.number().int(),
    total_pages: z.number().int().nonnegative(),
    total_coupons: z.number().int().nonnegative(),
  }),
});

export function createCoupon(client: CwClient, input: CwCouponInput): Promise<CwCoupon> {
  return client.post(COUPONS_PATH, input, cwCouponSchema);
}

/** Sends the whole coupon. Keep the input used at creation so it can be re-sent. */
export function updateCoupon(
  client: CwClient,
  id: number,
  input: CwCouponInput,
): Promise<CwCoupon> {
  return client.put(`${COUPONS_PATH}/${id}`, input, cwCouponSchema);
}

export function activateCoupon(
  client: CwClient,
  id: number,
  createdInput: CwCouponInput,
): Promise<CwCoupon> {
  return updateCoupon(client, id, { ...createdInput, active: true });
}

/**
 * Finds a coupon by code by walking every page.
 * Call it before retrying a failed creation so the store never gets duplicate coupons.
 * The page schema requires numeric pagination, so a response without `total_pages` is an
 * error rather than an endless loop.
 */
export async function findCouponByCode(client: CwClient, code: string): Promise<CwCoupon | null> {
  const target = code.trim().toUpperCase();
  for (let page = 1; ; page++) {
    const result = await client.get(COUPONS_PATH, couponPageSchema, {
      page,
      per_page: CW_PAGE_SIZE.coupons,
    });
    const match = result.coupons.find((coupon) => coupon.code?.toUpperCase() === target);
    if (match) return match;
    if (page >= result.pagination.total_pages) return null;
  }
}
