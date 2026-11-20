import { describe, expect, it } from "vitest";
import { CwRateLimitedError } from "@/application/ports";
import { CwResponseError } from "./http-client";
import { createCwOrderSource } from "./orders";

const order = {
  id: 90412,
  status: "closed",
  sales_channel: "catalog",
  total: 49.9,
  created_at: "2026-11-17T22:00:00-03:00",
  customer: { id: 7, name: "Cliente", phone: "11999999999" },
  discounts: [
    { category: "coupon", sponsorship: "merchant", total: 5, coupon_id: 55, coupon_code: "VOLTA5" },
    { category: "loyalty", sponsorship: "merchant", total: 1.1 },
  ],
};

function sourceReturning(status: number, body: unknown) {
  const urls: string[] = [];
  const fetchImpl = (async (url: URL | string) => {
    urls.push(String(url));
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return { source: createCwOrderSource({ fetchImpl }), urls };
}

function first<T>(items: readonly T[]): T {
  const item = items[0];
  if (item === undefined) throw new Error("expected at least one item");
  return item;
}

describe("createCwOrderSource.fetchOrderDetails", () => {
  it("maps the order to cents and keeps only the fields Volta stores", async () => {
    const { source, urls } = sourceReturning(200, order);
    const snapshot = await source.fetchOrderDetails("sandbox", "at", 90412);

    expect(first(urls)).toBe(
      "https://integracao.sandbox.cardapioweb.com/api/partner/v1/orders/90412",
    );
    expect(snapshot).toEqual({
      externalId: 90412,
      customerExternalId: 7,
      status: "closed",
      salesChannel: "catalog",
      totalCents: 4990,
      placedAt: new Date("2026-11-17T22:00:00-03:00"),
      discounts: [
        {
          category: "coupon",
          couponExternalId: 55,
          couponCode: "VOLTA5",
          amountCents: 500,
          sponsor: "merchant",
        },
        {
          category: "loyalty",
          couponExternalId: null,
          couponCode: null,
          amountCents: 110,
          sponsor: "merchant",
        },
      ],
    });
  });

  it("accepts an order without a customer", async () => {
    const { source } = sourceReturning(200, { ...order, customer: null, discounts: [] });
    const snapshot = await source.fetchOrderDetails("sandbox", "at", 90412);
    expect(snapshot.customerExternalId).toBeNull();
    expect(snapshot.discounts).toEqual([]);
  });

  it("refuses a body without a total instead of storing zero", async () => {
    const { source } = sourceReturning(200, { ...order, total: undefined });
    await expect(source.fetchOrderDetails("sandbox", "at", 90412)).rejects.toBeInstanceOf(
      CwResponseError,
    );
  });

  it("turns HTTP 429 into the rate-limit port error", async () => {
    const { source } = sourceReturning(429, { code: 429 });
    await expect(source.fetchOrderDetails("sandbox", "at", 90412)).rejects.toBeInstanceOf(
      CwRateLimitedError,
    );
  });
});

describe("createCwOrderSource.fetchHistoryPage", () => {
  it("sends the period and page, and returns the order ids and pagination", async () => {
    const { source, urls } = sourceReturning(200, {
      orders: [
        { id: 1, status: "closed" },
        { id: 2, status: "canceled" },
      ],
      pagination: { current_page: 1, total_pages: 4, total_orders: 350 },
    });
    const page = await source.fetchHistoryPage("sandbox", "at", {
      startDate: "2026-11-17T00:00:00-03:00",
      endDate: "2026-11-17T23:59:59-03:00",
      page: 1,
    });

    const url = new URL(first(urls));
    expect(url.pathname).toBe("/api/partner/v1/orders/history");
    expect(url.searchParams.get("start_date")).toBe("2026-11-17T00:00:00-03:00");
    expect(url.searchParams.get("per_page")).toBe("100");
    expect(page).toEqual({ orderIds: [1, 2], currentPage: 1, totalPages: 4 });
  });
});
