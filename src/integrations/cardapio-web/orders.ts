import { z } from "zod";
import {
  CwRateLimitedError,
  type CwOrderSource,
  type HistoryPageQuery,
  type OrderSnapshot,
  type StoreEnvironment,
} from "@/application/ports";
import { toCents } from "@/domain/shared/money";
import { CW_PAGE_SIZE } from "./config";
import { CwApiError, createCwClient } from "./http-client";

/**
 * CW order endpoints used by the sync worker.
 * - Details: GET /api/partner/v1/orders/{order_id}
 * - History: GET /api/partner/v1/orders/history (5 requests per minute per store)
 * Schemas follow generated/orders.ts. Only the fields Volta uses are required; the rest is
 * ignored. Discount sponsorship is required: a discount without it fails the sync for that order
 * until CW confirms the value for non-coupon discounts (see docs/open-questions.md).
 */

const DETAILS_PATH = "/api/partner/v1/orders";
const HISTORY_PATH = "/api/partner/v1/orders/history";

const discountSchema = z.looseObject({
  category: z.enum(["coupon", "loyalty", "other"]),
  sponsorship: z.enum(["merchant", "ifood"]),
  total: z.number(),
  coupon_id: z.number().int().nullable().optional(),
  coupon_code: z.string().nullable().optional(),
});

const orderDetailsSchema = z.looseObject({
  id: z.number().int(),
  status: z.string(),
  sales_channel: z.string(),
  total: z.number(),
  created_at: z.string(),
  customer: z.looseObject({ id: z.number().int() }).nullable().optional(),
  discounts: z.array(discountSchema).nullable().optional(),
});

const historySchema = z.object({
  orders: z.array(z.looseObject({ id: z.number().int() })),
  pagination: z.object({
    current_page: z.number().int(),
    total_pages: z.number().int().nonnegative(),
    total_orders: z.number().int().nonnegative(),
  }),
});

function toSnapshot(order: z.infer<typeof orderDetailsSchema>): OrderSnapshot {
  return {
    externalId: order.id,
    customerExternalId: order.customer?.id ?? null,
    status: order.status,
    salesChannel: order.sales_channel,
    totalCents: toCents(order.total),
    placedAt: new Date(order.created_at),
    discounts: (order.discounts ?? []).map((discount) => ({
      category: discount.category,
      couponExternalId: discount.coupon_id ?? null,
      couponCode: discount.coupon_code ?? null,
      amountCents: toCents(discount.total),
      sponsor: discount.sponsorship,
    })),
  };
}

/** Translates the HTTP 429 of CW into the port error the sync worker understands. */
async function withRateLimit<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof CwApiError && error.isRateLimited) throw new CwRateLimitedError();
    throw error;
  }
}

export function createCwOrderSource(options: { fetchImpl?: typeof fetch } = {}): CwOrderSource {
  return {
    async fetchOrderDetails(environment: StoreEnvironment, accessToken: string, orderId: number) {
      const client = createCwClient({ environment, accessToken, fetchImpl: options.fetchImpl });
      const order = await withRateLimit(() =>
        client.get(`${DETAILS_PATH}/${orderId}`, orderDetailsSchema),
      );
      return toSnapshot(order);
    },

    async fetchHistoryPage(
      environment: StoreEnvironment,
      accessToken: string,
      query: HistoryPageQuery,
    ) {
      const client = createCwClient({ environment, accessToken, fetchImpl: options.fetchImpl });
      const result = await withRateLimit(() =>
        client.get(HISTORY_PATH, historySchema, {
          start_date: query.startDate,
          end_date: query.endDate,
          page: query.page,
          per_page: CW_PAGE_SIZE.orderHistory,
        }),
      );
      return {
        orderIds: result.orders.map((order) => order.id),
        currentPage: result.pagination.current_page,
        totalPages: result.pagination.total_pages,
      };
    },
  };
}
