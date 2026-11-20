import { describe, expect, it } from "vitest";
import { CwRateLimitedError } from "@/application/ports";
import { createCwCustomerSource } from "./customers";
import { CwResponseError } from "./http-client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createCwCustomerSource", () => {
  it("fetches a page of customers and normalizes phone and WhatsApp opt-in", async () => {
    const urls: string[] = [];
    const source = createCwCustomerSource({
      fetchImpl: async (input) => {
        urls.push(String(input));
        return jsonResponse({
          customers: [
            {
              id: 10,
              name: "  Maria Silva  ",
              phone_number: " 85999990000 ",
              notifications_enabled: true,
              email: "ignored@example.com",
            },
            {
              id: 11,
              name: "   ",
              phone_number: "   ",
              notifications_enabled: false,
            },
          ],
          pagination: {
            current_page: 1,
            total_pages: 2,
            total_customers: 52,
          },
        });
      },
    });

    const page = await source.fetchCustomersPage("sandbox", "token-1", 1);
    expect(urls).toEqual([
      "https://integracao.sandbox.cardapioweb.com/api/partner/v1/merchant/customers?page=1&per_page=50",
    ]);
    expect(page).toEqual({
      customers: [
        {
          externalId: 10,
          name: "Maria Silva",
          phone: "85999990000",
          allowsWhatsapp: true,
        },
        {
          externalId: 11,
          name: "Cliente #11",
          phone: null,
          allowsWhatsapp: false,
        },
      ],
      currentPage: 1,
      totalPages: 2,
    });
  });

  it("translates HTTP 429 into CwRateLimitedError", async () => {
    const source = createCwCustomerSource({
      fetchImpl: async () => jsonResponse({ error: "too_many_requests" }, 429),
    });

    await expect(source.fetchCustomersPage("sandbox", "token-1", 1)).rejects.toBeInstanceOf(
      CwRateLimitedError,
    );
  });

  it("rejects responses that do not match the customer page schema", async () => {
    const source = createCwCustomerSource({
      fetchImpl: async () => jsonResponse({ customers: "invalid" }, 200),
    });

    await expect(source.fetchCustomersPage("sandbox", "token-1", 1)).rejects.toBeInstanceOf(
      CwResponseError,
    );
  });
});
