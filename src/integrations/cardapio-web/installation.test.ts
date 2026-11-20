import { describe, expect, it } from "vitest";
import { createCwInstallationGateway } from "./installation";

const identityBody = (company: unknown, user: unknown = { id: 9, name: "Maria", email: null }) => ({
  user,
  company,
  application: { id: "app", name: "Volta" },
  scopes: ["auth", "customers", "orders", "coupons"],
});

/** Answers the token exchange, then the identity call, like CW does after the code is sent. */
function gatewayWith(identityBodyValue: unknown) {
  const fetchImpl = (async (url: URL | string) => {
    const href = String(url);
    if (href.includes("/oauth/token")) {
      return new Response(
        JSON.stringify({
          access_token: "at",
          token_type: "Bearer",
          expires_in: 7200,
          refresh_token: "rt",
          scope: "auth orders",
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify(identityBodyValue), { status: 200 });
  }) as typeof fetch;
  return createCwInstallationGateway({
    environment: "sandbox",
    clientId: "client",
    redirectUri: "https://volta.test/cb",
    fetchImpl,
  });
}

describe("createCwInstallationGateway", () => {
  it("reads the store and user from identity/context, comparing ids as numbers", async () => {
    const gateway = gatewayWith(
      identityBody({ id: "123", name: "Pizzaria" }, { id: "9", name: "Maria" }),
    );
    const result = await gateway.completeAuthorization("code", "verifier");
    expect(result.identity).toEqual({
      storeExternalId: 123,
      storeName: "Pizzaria",
      userExternalId: 9,
      userName: "Maria",
      userEmail: null,
      scopes: ["auth", "customers", "orders", "coupons"],
    });
    expect(result.tokens).toEqual({
      accessToken: "at",
      refreshToken: "rt",
      expiresInSeconds: 7200,
    });
  });

  it("refuses an identity whose store id is not a positive integer", async () => {
    const gateway = gatewayWith(identityBody({ id: "abc", name: "X" }));
    await expect(gateway.completeAuthorization("code", "verifier")).rejects.toThrow();
  });

  it("refuses an identity response with a missing company", async () => {
    const gateway = gatewayWith({ user: { id: 1, name: "A" }, scopes: [] });
    await expect(gateway.completeAuthorization("code", "verifier")).rejects.toThrow();
  });
});
