import { describe, expect, it } from "vitest";
import { findCouponByCode, cwCouponSchema } from "./coupons";
import { CwResponseError, createCwClient } from "./http-client";

const coupon = (id: number, code: string | null) => ({
  id,
  uid: `uid${id}`,
  code,
  name: "Campanha",
  type: "percent_discount",
  value: 10,
  active: false,
  status: "not_active",
  minimum_order_value: null,
  use_limit: null,
  new_customers_only: false,
  customer_multi_use: true,
  available_from: "2026-11-18",
  expires_at: "2026-12-18",
});

/** Serves the given pages in order; each request is recorded so loops can be counted. */
function pagedClient(pages: unknown[]) {
  const requests: URL[] = [];
  const fetchImpl = (async (url: URL | string) => {
    requests.push(new URL(String(url)));
    const index = requests.length - 1;
    const body = pages[Math.min(index, pages.length - 1)];
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  const client = createCwClient({ environment: "sandbox", accessToken: "t", fetchImpl });
  return { client, requests };
}

describe("cwCouponSchema", () => {
  it("accepts a coupon as CW returns it", () => {
    expect(cwCouponSchema.safeParse(coupon(1, "VOLTA10")).success).toBe(true);
  });

  it("rejects a coupon without an id", () => {
    const withoutId: Record<string, unknown> = { ...coupon(1, "VOLTA10") };
    delete withoutId.id;
    expect(cwCouponSchema.safeParse(withoutId).success).toBe(false);
  });
});

describe("findCouponByCode", () => {
  it("walks pages until it finds the code, ignoring case and spaces", async () => {
    const { client, requests } = pagedClient([
      {
        coupons: [coupon(1, "OUTRO")],
        pagination: { current_page: 1, total_pages: 2, total_coupons: 2 },
      },
      {
        coupons: [coupon(2, "VOLTA10")],
        pagination: { current_page: 2, total_pages: 2, total_coupons: 2 },
      },
    ]);
    const found = await findCouponByCode(client, " volta10 ");
    expect(found?.id).toBe(2);
    expect(requests.map((url) => url.searchParams.get("page"))).toEqual(["1", "2"]);
  });

  it("returns null after the last page when the code does not exist", async () => {
    const { client, requests } = pagedClient([
      { coupons: [], pagination: { current_page: 1, total_pages: 1, total_coupons: 0 } },
    ]);
    await expect(findCouponByCode(client, "NAOEXISTE")).resolves.toBeNull();
    expect(requests).toHaveLength(1);
  });

  it("fails instead of looping when the pagination is missing total_pages", async () => {
    const { client, requests } = pagedClient([
      { coupons: [coupon(1, "OUTRO")], pagination: { current_page: 1, total_coupons: 1 } },
    ]);
    await expect(findCouponByCode(client, "VOLTA10")).rejects.toBeInstanceOf(CwResponseError);
    expect(requests).toHaveLength(1);
  });
});
