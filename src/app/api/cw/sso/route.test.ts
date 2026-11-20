import type * as nextServer from "next/server";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CwApiError } from "@/integrations/cardapio-web/http-client";
import { GET } from "./route";

const { openSsoSession } = vi.hoisted(() => ({ openSsoSession: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof nextServer>()),
  connection: async () => {},
}));
vi.mock("@/application/installation/open-sso-session", () => ({ openSsoSession }));
vi.mock("@/server/database/store-repositories", () => ({
  supabaseStoreCredentialsRepository: {},
  supabaseStoreUserRepository: {},
}));
vi.mock("@/server/database/sync-repositories", () => ({ supabaseStoreRegistry: {} }));

const STORE_ID = "3c231da2-758d-4eed-89f8-fdf1efd6eb20";

function ssoRequest(query: string) {
  return new NextRequest(`https://volta.test/api/cw/sso?${query}`, {
    headers: { cookie: "volta_session=previous-session" },
  });
}

function sessionCookie(response: Response) {
  return response.headers.get("set-cookie") ?? "";
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DEMO_MODE", "false");
  vi.stubEnv("APP_URL", "https://volta.test");
  vi.stubEnv("SESSION_SECRET", "test-session-secret");
  vi.stubEnv("CW_CLIENT_ID", "volta-client");
});

describe("GET /api/cw/sso", () => {
  it("opens the session and sends the person home without the ticket in the URL", async () => {
    openSsoSession.mockResolvedValue({ status: "opened", storeId: STORE_ID, userExternalId: 42 });

    const response = await GET(ssoRequest("ticket=ST-abc&company_external_id=123"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://volta.test/");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(sessionCookie(response)).toMatch(/volta_session=[^;]+\./);
    expect(openSsoSession).toHaveBeenCalledWith(
      expect.objectContaining({ ticket: "ST-abc", storeExternalId: 123 }),
      expect.anything(),
    );
  });

  it("clears any previous session when the sign-in is rejected", async () => {
    openSsoSession.mockResolvedValue({ status: "rejected", reason: "invalid_ticket" });

    const response = await GET(ssoRequest("ticket=ST-abc&company_external_id=123"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://volta.test/");
    expect(sessionCookie(response)).toMatch(/volta_session=;.*Max-Age=0/i);
  });

  it("clears the session when CW is unavailable", async () => {
    openSsoSession.mockRejectedValue(new CwApiError("CW responded 503", 503));

    const response = await GET(ssoRequest("ticket=ST-abc&company_external_id=123"));

    expect(response.status).toBe(303);
    expect(sessionCookie(response)).toMatch(/Max-Age=0/i);
  });

  it("does not call CW without a plausible ticket and store id", async () => {
    for (const query of [
      "company_external_id=123",
      "ticket=ST-abc",
      "ticket=ST-abc&company_external_id=abc",
      "ticket=ST-abc&company_external_id=-1",
      "ticket=ST-abc&company_external_id=1e3",
      "ticket=ST-abc&company_external_id=0",
      `ticket=${"x".repeat(600)}&company_external_id=123`,
    ]) {
      const response = await GET(ssoRequest(query));
      expect(response.status).toBe(303);
      expect(sessionCookie(response)).toMatch(/Max-Age=0/i);
    }
    expect(openSsoSession).not.toHaveBeenCalled();
  });

  it("does not consume the ticket when the session secret is missing", async () => {
    vi.stubEnv("SESSION_SECRET", "");
    await expect(GET(ssoRequest("ticket=ST-abc&company_external_id=123"))).rejects.toThrow(
      "SESSION_SECRET",
    );
    expect(openSsoSession).not.toHaveBeenCalled();
  });

  it("goes straight home in demo mode", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const response = await GET(ssoRequest("ticket=ST-abc&company_external_id=123"));
    expect(response.headers.get("location")).toBe("https://volta.test/");
    expect(openSsoSession).not.toHaveBeenCalled();
  });
});
