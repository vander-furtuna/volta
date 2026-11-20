import type {
  InstallationGateway,
  StoreEnvironment,
  StoreInstallationRepository,
} from "@/application/ports";

/** Raised when the authorization is valid but the app lacks scopes it needs to work. */
export class MissingScopesError extends Error {
  constructor(readonly missingScopes: readonly string[]) {
    super(`Missing CW scopes: ${missingScopes.join(", ")}`);
    this.name = "MissingScopesError";
  }
}

/**
 * Completes the CW installation: exchanges the code, checks scopes, and stores the store, its
 * encrypted tokens and the user account. Nothing is stored when a check fails.
 */
export async function installStore(
  input: { code: string; codeVerifier: string; environment: StoreEnvironment; now: Date },
  deps: {
    gateway: InstallationGateway;
    installations: StoreInstallationRepository;
    requiredScopes: readonly string[];
  },
): Promise<{ storeId: string }> {
  const { tokens, identity } = await deps.gateway.completeAuthorization(
    input.code,
    input.codeVerifier,
  );

  const missing = deps.requiredScopes.filter((scope) => !identity.scopes.includes(scope));
  if (missing.length > 0) throw new MissingScopesError(missing);

  return deps.installations.saveInstallation({
    identity,
    environment: input.environment,
    tokens,
    now: input.now,
  });
}
