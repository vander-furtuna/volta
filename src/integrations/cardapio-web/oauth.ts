import { z } from "zod";
import { cwEndpoints, type CwEnvironment } from "./config";

/**
 * CW OAuth 2.0 Authorization Code flow with PKCE.
 * Volta is a public client: there is no client secret.
 * Never log access_token, refresh_token, code or code_verifier.
 * Source: https://docs.cardapioweb.com/autenticacao/oauth.md
 */

const TOKEN_PATH = "/api/partner/oauth/token";
const REVOKE_PATH = "/api/partner/oauth/revoke";
const REFRESH_MARGIN_SECONDS = 300;

export interface OAuthConfig {
  environment: CwEnvironment;
  clientId: string;
  redirectUri: string;
}

const tokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.literal("Bearer"),
  expires_in: z.number(),
  refresh_token: z.string(),
  scope: z.string().optional(),
});

export type TokenResponse = z.infer<typeof tokenResponseSchema>;

export class OAuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "OAuthError";
  }
}

export function buildAuthorizationUrl(
  config: OAuthConfig,
  state: string,
  codeChallenge: string,
): string {
  const url = new URL(cwEndpoints(config.environment).authorizationPortal);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

async function postForm(
  config: OAuthConfig,
  path: string,
  form: Record<string, string>,
): Promise<Response> {
  return fetch(new URL(path, cwEndpoints(config.environment).api), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form),
    cache: "no-store",
  });
}

async function parseTokenResponse(response: Response): Promise<TokenResponse> {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new OAuthError("CW rejected the token request.", response.status, body.error);
  }
  return tokenResponseSchema.parse(await response.json());
}

export async function exchangeAuthorizationCode(
  config: OAuthConfig,
  code: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  const response = await postForm(config, TOKEN_PATH, {
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    code_verifier: codeVerifier,
  });
  return parseTokenResponse(response);
}

/**
 * Refreshes the access token (valid for 2 hours).
 * CW does not document whether refresh tokens rotate: always store the latest one received
 * and run at most one refresh per store at a time (see docs/architecture/cardapio-web-integration.md).
 */
export async function refreshAccessToken(
  config: OAuthConfig,
  refreshToken: string,
): Promise<TokenResponse> {
  const response = await postForm(config, TOKEN_PATH, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
  });
  return parseTokenResponse(response);
}

export async function revokeToken(config: OAuthConfig, token: string): Promise<void> {
  const response = await postForm(config, REVOKE_PATH, { token, client_id: config.clientId });
  if (!response.ok) throw new OAuthError("CW rejected the token revocation.", response.status);
}

/** When the access token should be refreshed, keeping a safety margin. */
export function refreshDeadline(token: TokenResponse, now = new Date()): Date {
  return new Date(now.getTime() + (token.expires_in - REFRESH_MARGIN_SECONDS) * 1000);
}
