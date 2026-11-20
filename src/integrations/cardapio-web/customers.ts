import { z } from "zod";
import {
  CwRateLimitedError,
  type CustomerSnapshot,
  type CwCustomerSource,
  type StoreEnvironment,
} from "@/application/ports";
import { CW_PAGE_SIZE } from "./config";
import { CwApiError, createCwClient } from "./http-client";

/**
 * CW merchant customers endpoint used by the sync worker.
 * - List: GET /api/partner/v1/merchant/customers (up to 50 per page, 300 req / 3 min per store)
 * Only the fields Volta uses are stored (LGPD data minimization: id, name, phone, WhatsApp opt-in).
 */

const CUSTOMERS_PATH = "/api/partner/v1/merchant/customers";

const customerSchema = z.looseObject({
  id: z.number().int().positive(),
  name: z.string(),
  phone_number: z.string().nullable().optional(),
  notifications_enabled: z.boolean().optional(),
});

const customersPageSchema = z.object({
  customers: z.array(customerSchema),
  pagination: z.object({
    current_page: z.number().int().positive(),
    total_pages: z.number().int().nonnegative(),
    total_customers: z.number().int().nonnegative(),
  }),
});

function toCustomerSnapshot(customer: z.infer<typeof customerSchema>): CustomerSnapshot {
  const trimmedName = customer.name.trim();
  const trimmedPhone = customer.phone_number?.trim() ?? "";
  return {
    externalId: customer.id,
    name: trimmedName === "" ? `Cliente #${customer.id}` : trimmedName,
    phone: trimmedPhone === "" ? null : trimmedPhone,
    allowsWhatsapp: customer.notifications_enabled ?? true,
  };
}

async function withRateLimit<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof CwApiError && error.isRateLimited) throw new CwRateLimitedError();
    throw error;
  }
}

export function createCwCustomerSource(
  options: { fetchImpl?: typeof fetch } = {},
): CwCustomerSource {
  return {
    async fetchCustomersPage(environment: StoreEnvironment, accessToken: string, page: number) {
      const client = createCwClient({ environment, accessToken, fetchImpl: options.fetchImpl });
      const result = await withRateLimit(() =>
        client.get(CUSTOMERS_PATH, customersPageSchema, {
          page,
          per_page: CW_PAGE_SIZE.customers,
        }),
      );
      return {
        customers: result.customers.map(toCustomerSnapshot),
        currentPage: result.pagination.current_page,
        totalPages: result.pagination.total_pages,
      };
    },
  };
}
