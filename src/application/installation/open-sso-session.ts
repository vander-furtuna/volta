import type {
  SsoTicketValidator,
  StoreCredentialsRepository,
  StoreRegistry,
  StoreUserRepository,
  TokenRefresher,
} from "@/application/ports";
import { refreshStoreToken } from "@/application/credentials/refresh-store-token";

/** Renew a token this close to expiring before using it, so CW does not refuse it mid-request. */
const TOKEN_MARGIN_MS = 60_000;
/** When another request is already renewing the token, wait for it a few times. */
const REFRESH_WAIT_ATTEMPTS = 3;
const REFRESH_WAIT_MS = 500;

export type SsoSessionResult =
  | { status: "opened"; storeId: string; userExternalId: number }
  | {
      status: "rejected";
      reason:
        | "store_not_installed"
        | "invalid_ticket"
        /** CW confirmed a person from another store than the one in the URL. */
        | "store_mismatch"
        /** No usable access token for the store, even after renewing it. */
        | "token_unavailable";
    };

export interface SsoSessionDeps {
  stores: StoreRegistry;
  credentials: StoreCredentialsRepository;
  refresher: TokenRefresher;
  validator: SsoTicketValidator;
  users: StoreUserRepository;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Signs someone in from the "Acessar" button in the CW portal.
 * Source: https://docs.cardapioweb.com/cw-app-store/onboarding-e-acesso.md
 *
 * 1. Find the installed store from `company_external_id`.
 * 2. Validate the single-use ticket with that store's own access token (renewed if needed).
 *    If CW refuses the token, renew it and validate again: the ticket was not consumed.
 * 3. Require the store CW confirms to be the store in the URL.
 * 4. Create the user on their first access (any store employee CW lets in) and open the session.
 *
 * Billing access is not checked here: a signed-in user of a blocked store sees the blocked
 * screen, and every protected call checks access again.
 */
export async function openSsoSession(
  input: { ticket: string; storeExternalId: number; now: Date },
  deps: SsoSessionDeps,
): Promise<SsoSessionResult> {
  const store = await deps.stores.findByExternalId(input.storeExternalId);
  if (!store) return rejected("store_not_installed");

  let accessToken = await usableAccessToken(store.storeId, input.now, null, deps);
  if (!accessToken) return rejected("token_unavailable");

  let result = await deps.validator.validate(store.environment, accessToken, input.ticket);
  if (result.status === "invalid_token") {
    accessToken = await usableAccessToken(store.storeId, input.now, accessToken, deps);
    if (!accessToken) return rejected("token_unavailable");
    result = await deps.validator.validate(store.environment, accessToken, input.ticket);
  }

  if (result.status === "invalid_token") return rejected("token_unavailable");
  if (result.status === "invalid_ticket") return rejected("invalid_ticket");

  const { identity } = result;
  if (identity.storeExternalId !== input.storeExternalId) return rejected("store_mismatch");

  await deps.users.upsertMember({
    storeId: store.storeId,
    userExternalId: identity.userExternalId,
    name: identity.userName,
    email: identity.userEmail,
  });

  return { status: "opened", storeId: store.storeId, userExternalId: identity.userExternalId };
}

function rejected(
  reason: Extract<SsoSessionResult, { status: "rejected" }>["reason"],
): SsoSessionResult {
  return { status: "rejected", reason };
}

/**
 * Returns an access token that is not about to expire and is not `refusedToken` (one CW just
 * refused). Renews it with the per-store lock; if another request holds the lock, waits for
 * its result. Null when the store has no credentials or no fresh token appears in time.
 */
async function usableAccessToken(
  storeId: string,
  now: Date,
  refusedToken: string | null,
  deps: SsoSessionDeps,
): Promise<string | null> {
  const isUsable = (credentials: { accessToken: string; accessTokenExpiresAt: Date }) =>
    credentials.accessToken !== refusedToken &&
    credentials.accessTokenExpiresAt.getTime() - now.getTime() > TOKEN_MARGIN_MS;

  const current = await deps.credentials.load(storeId);
  if (!current) return null;
  if (isUsable(current)) return current.accessToken;

  const sleep = deps.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 0; attempt < REFRESH_WAIT_ATTEMPTS; attempt += 1) {
    const outcome = await refreshStoreToken(
      { storeId, now },
      { credentials: deps.credentials, refresher: deps.refresher },
    );
    if (outcome.status === "no_credentials") return null;

    if (outcome.status === "busy") await sleep(REFRESH_WAIT_MS);
    const renewed = await deps.credentials.load(storeId);
    if (!renewed) return null;
    if (outcome.status === "refreshed" || isUsable(renewed)) return renewed.accessToken;
  }
  return null;
}
