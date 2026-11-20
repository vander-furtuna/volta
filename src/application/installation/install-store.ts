import type {
  InstallationGateway,
  StoreEnvironment,
  StoreInstallationRepository,
  SyncJobRepository,
} from "@/application/ports";
import { MS_PER_DAY } from "@/domain/shared/time";

/** Initial order history window queued on installation (CW allows up to 6 months per window). */
export const INITIAL_BACKFILL_DAYS = 180;

/** Raised when the authorization is valid but the app lacks scopes it needs to work. */
export class MissingScopesError extends Error {
  constructor(readonly missingScopes: readonly string[]) {
    super(`Missing CW scopes: ${missingScopes.join(", ")}`);
    this.name = "MissingScopesError";
  }
}

/**
 * Completes the CW installation: exchanges the code, checks scopes, stores the store, its
 * encrypted tokens and the user account, and queues the initial history backfill and customer sync.
 * Nothing is stored when a check fails.
 */
export async function installStore(
  input: { code: string; codeVerifier: string; environment: StoreEnvironment; now: Date },
  deps: {
    gateway: InstallationGateway;
    installations: StoreInstallationRepository;
    requiredScopes: readonly string[];
    jobs?: Pick<SyncJobRepository, "enqueue">;
  },
): Promise<{ storeId: string; userExternalId: number }> {
  const { tokens, identity } = await deps.gateway.completeAuthorization(
    input.code,
    input.codeVerifier,
  );

  const missing = deps.requiredScopes.filter((scope) => !identity.scopes.includes(scope));
  if (missing.length > 0) throw new MissingScopesError(missing);

  const installation = await deps.installations.saveInstallation({
    identity,
    environment: input.environment,
    tokens,
    now: input.now,
  });

  if (deps.jobs) {
    const startDate = new Date(
      input.now.getTime() - INITIAL_BACKFILL_DAYS * MS_PER_DAY,
    ).toISOString();
    const endDate = input.now.toISOString();
    await deps.jobs.enqueue({
      jobType: "backfill_order_history",
      storeExternalId: identity.storeExternalId,
      payload: { startDate, endDate, page: 1 },
      runAfter: input.now,
      dedupeKey: `backfill:${identity.storeExternalId}:${startDate}:${endDate}:1`,
    });
    await deps.jobs.enqueue({
      jobType: "sync_customers",
      storeExternalId: identity.storeExternalId,
      payload: { page: 1 },
      runAfter: input.now,
      dedupeKey: `customers:${identity.storeExternalId}:1`,
    });
  }

  return { ...installation, userExternalId: identity.userExternalId };
}
