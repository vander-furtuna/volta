import { CW_PAGE_SIZE } from "./config";
import type { CwClient } from "./http-client";

/**
 * CW coupons API.
 * - Create: POST /api/partner/v1/merchant/coupons
 * - Update: PUT  /api/partner/v1/merchant/coupons/{id} — full body; name, type and value are required
 * - List:   GET  /api/partner/v1/merchant/coupons — pagination only (max 20 per page), no code filter
 * The list has no usage counter: usage is counted from order discounts (coupon_id).
 * Source: https://docs.cardapioweb.com/api-reference/loja/cupons/
 */

const COUPONS_PATH = "/api/partner/v1/merchant/coupons";

export type CwCouponType = "flat_discount" | "percent_discount" | "free_shipping";
export type CwOrderType = "delivery" | "takeout" | "onsite";

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
  available_days?: number[];
  available_order_types: CwOrderType[];
  /** YYYY-MM-DD */
  available_from: string;
  /** YYYY-MM-DD; the coupon expires at 23:59 on this day */
  expires_at: string;
  item_ids?: number[];
}

export type CwCouponStatus =
  | "not_active"
  | "not_yet_available"
  | "expired"
  | "usage_limit_reached"
  | "not_available"
  | "valid";

export interface CwCoupon extends CwCouponInput {
  id: number;
  /** Used for automatic application through the menu link */
  uid: string;
  status: CwCouponStatus;
}

interface CwCouponPage {
  coupons: CwCoupon[];
  pagination: { current_page: number; total_pages: number; total_coupons: number };
}

export function createCoupon(client: CwClient, input: CwCouponInput): Promise<CwCoupon> {
  return client.post<CwCoupon>(COUPONS_PATH, input);
}

/** Sends the whole coupon. Keep the input used at creation so it can be re-sent. */
export function updateCoupon(
  client: CwClient,
  id: number,
  input: CwCouponInput,
): Promise<CwCoupon> {
  return client.put<CwCoupon>(`${COUPONS_PATH}/${id}`, input);
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
 */
export async function findCouponByCode(client: CwClient, code: string): Promise<CwCoupon | null> {
  const target = code.trim().toUpperCase();
  for (let page = 1; ; page++) {
    const result = await client.get<CwCouponPage>(COUPONS_PATH, {
      page,
      per_page: CW_PAGE_SIZE.coupons,
    });
    const match = result.coupons.find((coupon) => coupon.code?.toUpperCase() === target);
    if (match) return match;
    if (page >= result.pagination.total_pages) return null;
  }
}
