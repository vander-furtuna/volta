import { describe, expect, it } from "vitest";
import type {
  CwTokens,
  StoreCredentialsRepository,
  StoredCredentials,
  TokenRefresher,
} from "@/application/ports";
import { refreshStoreToken } from "./refresh-store-token";

const NOW = new Date("2026-11-18T12:00:00Z");
const FRESH: CwTokens = { accessToken: "new-at", refreshToken: "new-rt", expiresInSeconds: 7200 };

/** Lock with a lease, like the acquire_store_refresh_lock SQL function. */
function fakeCredentials(initial: { locked?: Date; stored?: StoredCredentials | null } = {}) {
  let lockedSince: Date | null = initial.locked ?? null;
  const stored =
    initial.stored === undefined
      ? {
          accessToken: "at",
          accessTokenExpiresAt: new Date("2026-11-18T13:00:00Z"),
          refreshToken: "rt",
          environment: "sandbox" as const,
        }
      : initial.stored;
  const saves: CwTokens[] = [];
  const repo: StoreCredentialsRepository = {
    async acquireRefreshLock(_id, now, leaseSeconds) {
      const expired =
        lockedSince === null || lockedSince.getTime() < now.getTime() - leaseSeconds * 1000;
      if (!expired) return false;
      lockedSince = now;
      return true;
    },
    async load() {
      return stored;
    },
    async saveRefreshedAndRelease(_id, tokens) {
      saves.push(tokens);
      lockedSince = null;
    },
    async releaseRefreshLock() {
      lockedSince = null;
    },
  };
  return { repo, saves, isLocked: () => lockedSince !== null };
}

function fakeRefresher(result: CwTokens | Error) {
  const calls: string[] = [];
  const refresher: TokenRefresher = {
    async refresh(_env, refreshToken) {
      calls.push(refreshToken);
      if (result instanceof Error) throw result;
      return result;
    },
  };
  return { refresher, calls };
}

describe("refreshStoreToken", () => {
  it("saves the new tokens and releases the lock", async () => {
    const creds = fakeCredentials();
    const { refresher, calls } = fakeRefresher(FRESH);
    await expect(
      refreshStoreToken({ storeId: "s", now: NOW }, { credentials: creds.repo, refresher }),
    ).resolves.toEqual({ status: "refreshed" });
    expect(calls).toEqual(["rt"]);
    expect(creds.saves).toEqual([FRESH]);
    expect(creds.isLocked()).toBe(false);
  });

  it("allows a later refresh once the previous one released the lock", async () => {
    const creds = fakeCredentials();
    const { refresher, calls } = fakeRefresher(FRESH);
    const deps = { credentials: creds.repo, refresher };

    const first = await refreshStoreToken({ storeId: "s", now: NOW }, deps);
    const second = await refreshStoreToken({ storeId: "s", now: NOW }, deps);

    expect(first.status).toBe("refreshed");
    expect(second.status).toBe("refreshed");
    expect(calls).toHaveLength(2);
  });

  it("does nothing while another worker holds a live lock", async () => {
    const creds = fakeCredentials({ locked: new Date(NOW.getTime() - 10_000) });
    const { refresher, calls } = fakeRefresher(FRESH);
    await expect(
      refreshStoreToken({ storeId: "s", now: NOW }, { credentials: creds.repo, refresher }),
    ).resolves.toEqual({ status: "busy" });
    expect(calls).toHaveLength(0);
    expect(creds.saves).toHaveLength(0);
  });

  it("takes over a lock whose lease expired", async () => {
    const creds = fakeCredentials({ locked: new Date(NOW.getTime() - 300_000) });
    const { refresher } = fakeRefresher(FRESH);
    await expect(
      refreshStoreToken({ storeId: "s", now: NOW }, { credentials: creds.repo, refresher }),
    ).resolves.toEqual({ status: "refreshed" });
  });

  it("releases the lock without saving when CW rejects the refresh", async () => {
    const creds = fakeCredentials();
    const { refresher } = fakeRefresher(new Error("CW rejected the token request."));
    await expect(
      refreshStoreToken({ storeId: "s", now: NOW }, { credentials: creds.repo, refresher }),
    ).rejects.toThrow("CW rejected");
    expect(creds.saves).toHaveLength(0);
    expect(creds.isLocked()).toBe(false);
  });

  it("reports missing credentials and releases the lock", async () => {
    const creds = fakeCredentials({ stored: null });
    const { refresher, calls } = fakeRefresher(FRESH);
    await expect(
      refreshStoreToken({ storeId: "s", now: NOW }, { credentials: creds.repo, refresher }),
    ).resolves.toEqual({ status: "no_credentials" });
    expect(calls).toHaveLength(0);
    expect(creds.isLocked()).toBe(false);
  });
});
