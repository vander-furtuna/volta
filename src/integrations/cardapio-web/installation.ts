import { z } from "zod";
import type {
  CwIdentity,
  CwTokens,
  InstallationGateway,
  StoreEnvironment,
  TokenRefresher,
} from "@/application/ports";
import { CwResponseError, createCwClient } from "./http-client";
import { exchangeAuthorizationCode, refreshAccessToken, type OAuthConfig } from "./oauth";

/**
 * Installation adapters for the CW app store flow.
 * Source for the identity shape: generated/identity.ts (identity/context), documented in
 * https://docs.cardapioweb.com/cw-app-store/onboarding-e-acesso
 */

const IDENTITY_PATH = "/api/partner/v1/identity/context";

/** CW may send ids as strings or numbers, so both are accepted and compared as text. */
const cwIdSchema = z.union([z.string(), z.number()]).transform((value) => String(value));
const numericIdSchema = cwIdSchema.refine((value) => /^\d{1,18}$/.test(value), {
  message: "id must be a positive integer",
});

const identityContextSchema = z.object({
  user: z.object({
    id: numericIdSchema,
    name: z.string(),
    email: z.string().nullable().optional(),
  }),
  company: z.object({
    id: numericIdSchema,
    name: z.string(),
  }),
  application: z.object({ id: z.string(), name: z.string() }),
  scopes: z.array(z.string()),
});

function toOAuthConfig(
  environment: StoreEnvironment,
  clientId: string,
  redirectUri: string,
  fetchImpl?: typeof fetch,
) {
  return { environment, clientId, redirectUri, fetchImpl } satisfies OAuthConfig;
}

function toCwTokens(response: { access_token: string; refresh_token: string; expires_in: number }) {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expiresInSeconds: response.expires_in,
  } satisfies CwTokens;
}

export function createCwInstallationGateway(options: {
  environment: StoreEnvironment;
  clientId: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): InstallationGateway {
  const config = toOAuthConfig(
    options.environment,
    options.clientId,
    options.redirectUri,
    options.fetchImpl,
  );
  return {
    async completeAuthorization(code, codeVerifier) {
      const token = await exchangeAuthorizationCode(config, code, codeVerifier);
      const client = createCwClient({
        environment: options.environment,
        accessToken: token.access_token,
        fetchImpl: options.fetchImpl,
      });
      const context = await client.get(IDENTITY_PATH, identityContextSchema);

      const identity: CwIdentity = {
        storeExternalId: Number(context.company.id),
        storeName: context.company.name,
        userExternalId: Number(context.user.id),
        userName: context.user.name,
        userEmail: context.user.email ?? null,
        scopes: context.scopes,
      };
      if (!Number.isSafeInteger(identity.storeExternalId)) {
        throw new CwResponseError("CW returned an unsafe store id", IDENTITY_PATH);
      }
      return { tokens: toCwTokens(token), identity };
    },
  };
}

export function createCwTokenRefresher(options: {
  clientId: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): TokenRefresher {
  return {
    async refresh(environment, refreshToken) {
      const config = toOAuthConfig(
        environment,
        options.clientId,
        options.redirectUri,
        options.fetchImpl,
      );
      return toCwTokens(await refreshAccessToken(config, refreshToken));
    },
  };
}
