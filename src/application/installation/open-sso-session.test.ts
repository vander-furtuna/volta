import { describe, expect, it } from "vitest";
import type {
  SsoTicketResult,
  StoreCredentialsRepository,
  StoredCredentials,
  TokenRefresher,
} from "@/application/ports";
import { openSsoSession, type SsoSessionDeps } from "./open-sso-session";

const now = new Date("2026-11-20T12:00:00Z");
const STORE_ID = "3c231da2-758d-4eed-89f8-fdf1efd6eb20";
const inOneHour = new Date(now.getTime() + 3_600_000);

const validFor = (storeExternalId = 123): SsoTicketResult => ({
  status: "valid",
  identity: { storeExternalId, userExternalId: 42, userName: "João", userEmail: null },
});

function setup(
  options: {
    credentials?: StoredCredentials | null;
    validations?: SsoTicketResult[];
    lockBusy?: boolean;
    refreshFails?: boolean;
  } = {},
) {
  let stored: StoredCredentials | null =
    options.credentials === undefined
      ? {
          accessToken: "token-1",
          accessTokenExpiresAt: inOneHour,
          refreshToken: "refresh-1",
          environment: "sandbox",
        }
      : options.credentials;
  const validations = [...(options.validations ?? [validFor()])];
  const tokensSent: string[] = [];
  const members: unknown[] = [];
  let refreshes = 0;

  const credentials: StoreCredentialsRepository = {
    acquireRefreshLock: async () => !options.lockBusy,
    load: async () => stored,
    saveRefreshedAndRelease: async (_storeId, tokens, at) => {
      stored = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessTokenExpiresAt: new Date(at.getTime() + tokens.expiresInSeconds * 1000),
        environment: "sandbox",
      };
    },
    releaseRefreshLock: async () => {},
  };
  const refresher: TokenRefresher = {
    refresh: async () => {
      if (options.refreshFails) throw new Error("CW refused the refresh token");
      refreshes += 1;
      return {
        accessToken: `token-${refreshes + 1}`,
        refreshToken: "refresh-2",
        expiresInSeconds: 7200,
      };
    },
  };

  const deps: SsoSessionDeps = {
    stores: {
      findByExternalId: async (externalId) =>
        externalId === 123 ? { storeId: STORE_ID, environment: "sandbox", allowed: true } : null,
    },
    credentials,
    refresher,
    validator: {
      validate: async (_environment, accessToken) => {
        tokensSent.push(accessToken);
        const next = validations.shift();
        if (!next) throw new Error("ticket validated more times than expected");
        return next;
      },
    },
    users: { upsertMember: async (member) => void members.push(member) },
    sleep: async () => {},
  };

  return { deps, tokensSent, members, refreshCount: () => refreshes };
}

const signIn = (deps: SsoSessionDeps, storeExternalId = 123) =>
  openSsoSession({ ticket: "ST-1", storeExternalId, now }, deps);

describe("openSsoSession", () => {
  it("validates the ticket with the store's token and signs the person in", async () => {
    const { deps, tokensSent, members } = setup();

    await expect(signIn(deps)).resolves.toEqual({
      status: "opened",
      storeId: STORE_ID,
      userExternalId: 42,
    });
    expect(tokensSent).toEqual(["token-1"]);
    expect(members).toEqual([{ storeId: STORE_ID, userExternalId: 42, name: "João", email: null }]);
  });

  it("refuses a store that is not installed, without calling CW", async () => {
    const { deps, tokensSent } = setup();
    await expect(signIn(deps, 999)).resolves.toEqual({
      status: "rejected",
      reason: "store_not_installed",
    });
    expect(tokensSent).toEqual([]);
  });

  it("refuses an invalid ticket and never sends it again", async () => {
    const { deps, tokensSent, members } = setup({ validations: [{ status: "invalid_ticket" }] });
    await expect(signIn(deps)).resolves.toEqual({ status: "rejected", reason: "invalid_ticket" });
    expect(tokensSent).toHaveLength(1);
    expect(members).toEqual([]);
  });

  it("refuses a person CW confirms for another store than the one in the URL", async () => {
    const { deps, members } = setup({ validations: [validFor(456)] });
    await expect(signIn(deps)).resolves.toEqual({ status: "rejected", reason: "store_mismatch" });
    expect(members).toEqual([]);
  });

  it("renews a token about to expire before validating", async () => {
    const { deps, tokensSent } = setup({
      credentials: {
        accessToken: "token-1",
        accessTokenExpiresAt: new Date(now.getTime() + 30_000),
        refreshToken: "refresh-1",
        environment: "sandbox",
      },
    });
    await expect(signIn(deps)).resolves.toMatchObject({ status: "opened" });
    expect(tokensSent).toEqual(["token-2"]);
  });

  it("renews the token and validates again when CW refuses the token", async () => {
    const { deps, tokensSent, refreshCount } = setup({
      validations: [{ status: "invalid_token" }, validFor()],
    });
    await expect(signIn(deps)).resolves.toMatchObject({ status: "opened" });
    expect(tokensSent).toEqual(["token-1", "token-2"]);
    expect(refreshCount()).toBe(1);
  });

  it("gives up when CW still refuses the renewed token", async () => {
    const { deps } = setup({
      validations: [{ status: "invalid_token" }, { status: "invalid_token" }],
    });
    await expect(signIn(deps)).resolves.toEqual({
      status: "rejected",
      reason: "token_unavailable",
    });
  });

  it("gives up when the store has no credentials or another request keeps the refresh lock", async () => {
    const noCredentials = setup({ credentials: null });
    await expect(signIn(noCredentials.deps)).resolves.toEqual({
      status: "rejected",
      reason: "token_unavailable",
    });

    const busy = setup({ validations: [{ status: "invalid_token" }], lockBusy: true });
    await expect(signIn(busy.deps)).resolves.toEqual({
      status: "rejected",
      reason: "token_unavailable",
    });
    expect(busy.tokensSent).toEqual(["token-1"]);
  });

  it("lets a failed refresh propagate so the route can show that CW is unavailable", async () => {
    const { deps } = setup({ validations: [{ status: "invalid_token" }], refreshFails: true });
    await expect(signIn(deps)).rejects.toThrow("CW refused the refresh token");
  });
});
