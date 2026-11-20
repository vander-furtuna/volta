import { NextResponse, type NextRequest } from "next/server";
import { MissingScopesError, installStore } from "@/application/installation/install-store";
import { CwApiError, CwResponseError } from "@/integrations/cardapio-web/http-client";
import { createCwInstallationGateway } from "@/integrations/cardapio-web/installation";
import { REQUIRED_CW_SCOPES } from "@/integrations/cardapio-web/config";
import { OAuthError } from "@/integrations/cardapio-web/oauth";
import { readEnv, requireEnv } from "@/server/config/env";
import { setStoreSession } from "@/server/security/store-session";
import { secretsMatch } from "@/server/security/secret-compare";
import { supabaseStoreInstallationRepository } from "@/server/database/store-repositories";
import { supabaseSyncJobRepository } from "@/server/database/sync-repositories";
import { OAUTH_COOKIE, oauthCookieOptions } from "../cookies";

/** CW redirects here with `code` and `state` after the owner authorizes the app. */
export async function GET(request: NextRequest) {
  const env = readEnv();
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get(OAUTH_COOKIE.state)?.value;
  const codeVerifier = request.cookies.get(OAUTH_COOKIE.verifier)?.value;

  if (!code || !state || !expectedState || !codeVerifier || !secretsMatch(state, expectedState)) {
    return withOAuthCookiesCleared(
      NextResponse.json({ error: "invalid_oauth_state" }, { status: 400 }),
    );
  }

  try {
    requireEnv("SESSION_SECRET", env);
    const session = await installStore(
      { code, codeVerifier, environment: env.CW_ENVIRONMENT, now: new Date() },
      {
        gateway: createCwInstallationGateway({
          environment: env.CW_ENVIRONMENT,
          clientId: requireEnv("CW_CLIENT_ID", env),
          redirectUri: env.CW_REDIRECT_URI,
        }),
        installations: supabaseStoreInstallationRepository,
        requiredScopes: REQUIRED_CW_SCOPES,
        jobs: supabaseSyncJobRepository,
      },
    );
    const response = withOAuthCookiesCleared(NextResponse.redirect(new URL("/", env.APP_URL)));
    setStoreSession(response, session);
    return response;
  } catch (error) {
    if (error instanceof MissingScopesError) {
      return withOAuthCookiesCleared(
        NextResponse.json(
          { error: "missing_scopes", scopes: error.missingScopes },
          { status: 403 },
        ),
      );
    }
    if (
      error instanceof OAuthError ||
      error instanceof CwApiError ||
      error instanceof CwResponseError
    ) {
      return withOAuthCookiesCleared(
        NextResponse.json({ error: "cw_exchange_failed" }, { status: 502 }),
      );
    }
    throw error;
  }
}

function withOAuthCookiesCleared(response: NextResponse): NextResponse {
  response.cookies.set(OAUTH_COOKIE.state, "", { ...oauthCookieOptions(), maxAge: 0 });
  response.cookies.set(OAUTH_COOKIE.verifier, "", { ...oauthCookieOptions(), maxAge: 0 });
  return response;
}
