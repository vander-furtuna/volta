import { describe, expect, it } from "vitest";
import { createCwSsoTicketValidator, isPlausibleSsoTicket } from "./sso";

const validBody = {
  valid: true,
  app_id: "app",
  client_id: "volta-client",
  user: { id: "9", name: "Maria", email: "maria@pizzaria.test" },
  company: { id: 123, name: "Pizzaria" },
};

function validatorAnswering(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchImpl = (async (url: URL | string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return { validator: createCwSsoTicketValidator({ clientId: "volta-client", fetchImpl }), calls };
}

describe("createCwSsoTicketValidator", () => {
  it("sends the ticket with the store's bearer token and reads who signed in", async () => {
    const { validator, calls } = validatorAnswering(200, validBody);

    await expect(validator.validate("sandbox", "store-token", "ST-abc")).resolves.toEqual({
      status: "valid",
      identity: {
        storeExternalId: 123,
        userExternalId: 9,
        userName: "Maria",
        userEmail: "maria@pizzaria.test",
      },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain("/api/partner/v1/identity/sso_tickets/validate");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ ticket: "ST-abc" }));
    expect(new Headers(calls[0]?.init?.headers).get("authorization")).toBe("Bearer store-token");
  });

  it("tells an unusable ticket apart from a refused token, both answered with 401", async () => {
    const ticket = validatorAnswering(401, { valid: false, error: "invalid_ticket" });
    await expect(ticket.validator.validate("sandbox", "t", "ST-1")).resolves.toEqual({
      status: "invalid_ticket",
    });

    const token = validatorAnswering(401, { code: 4010, message: "Token inválido." });
    await expect(token.validator.validate("sandbox", "t", "ST-1")).resolves.toEqual({
      status: "invalid_token",
    });
  });

  it("refuses a ticket issued for another app", async () => {
    const { validator } = validatorAnswering(200, { ...validBody, client_id: "other-app" });
    await expect(validator.validate("sandbox", "t", "ST-1")).resolves.toEqual({
      status: "invalid_ticket",
    });
  });

  it("does not trust a success body without valid: true or with malformed ids", async () => {
    const notValid = validatorAnswering(200, { ...validBody, valid: false });
    await expect(notValid.validator.validate("sandbox", "t", "ST-1")).resolves.toEqual({
      status: "invalid_ticket",
    });

    const badId = validatorAnswering(200, { ...validBody, user: { id: "abc", name: "X" } });
    await expect(badId.validator.validate("sandbox", "t", "ST-1")).resolves.toEqual({
      status: "invalid_ticket",
    });
  });

  it("lets other CW failures propagate, such as a missing auth scope", async () => {
    const { validator } = validatorAnswering(403, { code: 4030 });
    await expect(validator.validate("sandbox", "t", "ST-1")).rejects.toThrow("403");
  });
});

describe("isPlausibleSsoTicket", () => {
  it("accepts printable tickets of a sane size only", () => {
    expect(isPlausibleSsoTicket("ST-0f2b9c")).toBe(true);
    expect(isPlausibleSsoTicket("")).toBe(false);
    expect(isPlausibleSsoTicket("ST-a b")).toBe(false);
    expect(isPlausibleSsoTicket("x".repeat(513))).toBe(false);
  });
});
