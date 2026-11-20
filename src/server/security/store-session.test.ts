import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStoreSession } from "./store-session";
import { signStoreSession } from "./store-session-token";

const { cookie, member, filter } = vi.hoisted(() => ({
  cookie: vi.fn(),
  member: vi.fn(),
  filter: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookie }) }));
vi.mock("@/server/database/supabase", () => ({
  getServiceClient: () => ({
    from: () => ({ select: () => ({ eq: filter, maybeSingle: member }) }),
  }),
}));

const storeId = "3c231da2-758d-4eed-89f8-fdf1efd6eb20";
const userId = "c1d24f7e-b06e-489e-acb3-ce1a896d8411";
const secret = "test-session-secret";

function storeAccess(accessUntil: string | null, uninstalledAt: string | null = null) {
  member.mockResolvedValue({
    error: null,
    data: {
      id: userId,
      stores: {
        name: "Loja Teste",
        uninstalled_at: uninstalledAt,
        store_access: { allowed: true, access_until: accessUntil },
      },
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SESSION_SECRET", secret);
  filter.mockReturnValue({ eq: filter, maybeSingle: member });
  cookie.mockReturnValue({ value: signStoreSession({ storeId, userExternalId: 42 }, secret) });
});

describe("getStoreSession", () => {
  it("requires membership of the signed user in the signed store", async () => {
    storeAccess(null);
    await expect(getStoreSession()).resolves.toEqual({
      status: "authenticated",
      storeId,
      userId,
      storeName: "Loja Teste",
    });
    expect(filter.mock.calls).toEqual([
      ["store_id", storeId],
      ["external_id", 42],
    ]);
    member.mockResolvedValue({ data: null, error: null });
    await expect(getStoreSession()).resolves.toEqual({ status: "unauthenticated" });
  });

  it("blocks an expired subscription or inactive installation", async () => {
    storeAccess("2020-01-01T00:00:00+00:00");
    await expect(getStoreSession()).resolves.toEqual({ status: "blocked" });
    storeAccess(null, "2020-01-01T00:00:00+00:00");
    await expect(getStoreSession()).resolves.toEqual({ status: "blocked" });
  });

  it("skips the database when the session is invalid", async () => {
    cookie.mockReturnValue({ value: "invalid" });
    await expect(getStoreSession()).resolves.toEqual({ status: "unauthenticated" });
    expect(member).not.toHaveBeenCalled();
  });
});
