import "server-only";
import { z } from "zod";
import type { CustomerRepository, CustomerSnapshot } from "@/application/ports";
import {
  AUDIENCE_HISTORY_DAYS,
  computeAudienceOfferContext,
  summarizeStoreCustomers,
  type StoreCustomerSummary,
  type StoredCustomerRecord,
  type StoredInvitationRecord,
  type StoredOrderRecord,
} from "@/domain/audience/store-audience";
import { MS_PER_DAY } from "@/domain/shared/time";
import type { OfferContext } from "@/domain/offer/offer";
import { getServiceClient } from "./supabase";

const PAGE_SIZE = 500;
const idSchema = z.number().int().positive();

const storeIdRowSchema = z.object({
  id: z.uuid(),
});

const customerPageSchema = z.array(
  z.object({
    external_id: idSchema,
    name: z.string(),
    phone: z.string().nullable(),
    allows_whatsapp: z.boolean(),
  }),
);

const orderPageSchema = z.array(
  z.object({
    id: z.uuid(),
    customer_external_id: idSchema.nullable(),
    outcome: z.enum(["completed", "canceled", "open"]),
    total: z.number(),
    placed_at: z.iso.datetime({ offset: true }),
  }),
);

const invitationPageSchema = z.array(
  z.object({
    customer_external_id: idSchema,
    campaigns: z.object({
      invitations_marked_at: z.iso.datetime({ offset: true }),
    }),
  }),
);

const frozenAudiencePageSchema = z.array(
  z.object({
    customer_external_id: idSchema,
  }),
);

export async function upsertStoreCustomers(
  storeId: string,
  customers: readonly CustomerSnapshot[],
  now = new Date(),
): Promise<void> {
  if (customers.length === 0) return;
  const syncedAt = now.toISOString();
  const rows = customers.map((customer) => ({
    store_id: storeId,
    external_id: customer.externalId,
    name: customer.name,
    phone: customer.phone,
    allows_whatsapp: customer.allowsWhatsapp,
    synced_at: syncedAt,
  }));

  const { error } = await getServiceClient()
    .from("customers")
    .upsert(rows, { onConflict: "store_id,external_id" });
  if (error) throw error;
}

export const supabaseCustomerRepository: CustomerRepository = {
  async saveBatch(storeExternalId, customers) {
    if (customers.length === 0) return;
    const { data, error } = await getServiceClient()
      .from("stores")
      .select("id")
      .eq("external_id", storeExternalId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`unknown store ${storeExternalId}`);
    const store = storeIdRowSchema.parse(data);
    await upsertStoreCustomers(store.id, customers);
  },
};

export async function readStoreCustomers(storeId: string): Promise<StoredCustomerRecord[]> {
  const customers: StoredCustomerRecord[] = [];
  let after = 0;
  while (true) {
    const { data, error } = await getServiceClient()
      .from("customers")
      .select("external_id, name, phone, allows_whatsapp")
      .eq("store_id", storeId)
      .gt("external_id", after)
      .order("external_id")
      .limit(PAGE_SIZE);
    if (error) throw error;
    const page = customerPageSchema.parse(data ?? []);
    for (const row of page) {
      customers.push({
        externalId: row.external_id,
        name: row.name,
        phone: row.phone,
        allowsWhatsapp: row.allows_whatsapp,
      });
      after = row.external_id;
    }
    if (page.length < PAGE_SIZE) return customers;
  }
}

export async function readStoreOrdersInWindow(
  storeId: string,
  startsAt: Date,
  endsAt: Date,
): Promise<StoredOrderRecord[]> {
  const orders: StoredOrderRecord[] = [];
  let after: string | undefined;
  while (true) {
    let query = getServiceClient()
      .from("orders")
      .select("id, customer_external_id, outcome, total, placed_at")
      .eq("store_id", storeId)
      .gte("placed_at", startsAt.toISOString())
      .lte("placed_at", endsAt.toISOString())
      .order("id")
      .limit(PAGE_SIZE);
    if (after) query = query.gt("id", after);
    const { data, error } = await query;
    if (error) throw error;
    const page = orderPageSchema.parse(data ?? []);
    for (const row of page) {
      orders.push({
        customerExternalId: row.customer_external_id,
        outcome: row.outcome,
        total: row.total,
        placedAt: new Date(row.placed_at),
      });
      after = row.id;
    }
    if (page.length < PAGE_SIZE) return orders;
  }
}

export async function readStoreInvitations(storeId: string): Promise<StoredInvitationRecord[]> {
  const { data, error } = await getServiceClient()
    .from("campaign_audience")
    .select("customer_external_id, campaigns!inner(store_id, invitations_marked_at)")
    .eq("campaigns.store_id", storeId)
    .eq("included", true)
    .not("campaigns.invitations_marked_at", "is", null)
    .limit(5000);
  if (error) throw error;
  return invitationPageSchema.parse(data ?? []).map((row) => ({
    customerExternalId: row.customer_external_id,
    invitedAt: new Date(row.campaigns.invitations_marked_at),
  }));
}

export async function readStoreCustomerSummaries(
  storeId: string,
  now = new Date(),
): Promise<StoreCustomerSummary[]> {
  const startsAt = new Date(now.getTime() - AUDIENCE_HISTORY_DAYS * MS_PER_DAY);
  const [customers, orders, invitations] = await Promise.all([
    readStoreCustomers(storeId),
    readStoreOrdersInWindow(storeId, startsAt, now),
    readStoreInvitations(storeId),
  ]);
  return summarizeStoreCustomers({
    customers,
    orders,
    invitations,
    now,
  });
}

async function readIncludedAudienceIds(storeId: string, campaignId: string): Promise<Set<number>> {
  const included = new Set<number>();
  let after = 0;
  while (true) {
    const { data, error } = await getServiceClient()
      .from("campaign_audience")
      .select("customer_external_id, campaigns!inner(store_id)")
      .eq("campaign_id", campaignId)
      .eq("campaigns.store_id", storeId)
      .eq("included", true)
      .gt("customer_external_id", after)
      .order("customer_external_id")
      .limit(PAGE_SIZE);
    if (error) throw error;
    const page = frozenAudiencePageSchema.parse(data ?? []);
    for (const row of page) {
      included.add(row.customer_external_id);
      after = row.customer_external_id;
    }
    if (page.length < PAGE_SIZE) return included;
  }
}

export async function readStoreOfferContext(
  storeId: string,
  campaignId: string,
  now = new Date(),
): Promise<OfferContext> {
  const startsAt = new Date(now.getTime() - AUDIENCE_HISTORY_DAYS * MS_PER_DAY);
  const [orders, audienceIds] = await Promise.all([
    readStoreOrdersInWindow(storeId, startsAt, now),
    readIncludedAudienceIds(storeId, campaignId),
  ]);
  return computeAudienceOfferContext(orders, audienceIds);
}
