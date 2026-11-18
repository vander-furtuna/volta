import { NextResponse, type NextRequest } from "next/server";
import { exchangeAuthorizationCode, OAuthError } from "@/integrations/cardapio-web/oauth";
import { readEnv, requireEnv } from "@/server/config/env";
import { OAUTH_COOKIE, oauthCookieOptions } from "../cookies";

/** CW redirects here with `code` and `state` after the owner authorizes the app. */
export async function GET(request: NextRequest) {
  const env = readEnv();
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get(OAUTH_COOKIE.state)?.value;
  const codeVerifier = request.cookies.get(OAUTH_COOKIE.verifier)?.value;

  if (!code || !state || !expectedState || !codeVerifier || state !== expectedState) {
    return NextResponse.json({ error: "invalid_oauth_state" }, { status: 400 });
  }

  try {
    await exchangeAuthorizationCode(
      {
        environment: env.CW_ENVIRONMENT,
        clientId: requireEnv("CW_CLIENT_ID", env),
        redirectUri: env.CW_REDIRECT_URI,
      },
      code,
      codeVerifier,
    );
    // TODO(installation): read GET /api/partner/v1/identity/context, encrypt and store the tokens
    // per store, create the user account and open a session. See docs/architecture/cardapio-web-integration.md.
  } catch (error) {
    if (error instanceof OAuthError) {
      return NextResponse.json(
        { error: "oauth_exchange_failed", status: error.status },
        { status: 502 },
      );
    }
    throw error;
  }

  const response = NextResponse.redirect(new URL("/", env.APP_URL));
  response.cookies.set(OAUTH_COOKIE.state, "", { ...oauthCookieOptions(), maxAge: 0 });
  response.cookies.set(OAUTH_COOKIE.verifier, "", { ...oauthCookieOptions(), maxAge: 0 });
  return response;
}
