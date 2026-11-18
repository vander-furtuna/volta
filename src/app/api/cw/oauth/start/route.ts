import { NextResponse } from "next/server";
import { buildAuthorizationUrl } from "@/integrations/cardapio-web/oauth";
import {
  createCodeChallenge,
  createCodeVerifier,
  createState,
} from "@/integrations/cardapio-web/pkce";
import { readEnv, requireEnv } from "@/server/config/env";
import { OAUTH_COOKIE, oauthCookieOptions } from "../cookies";

/** Starts the CW install/authorization flow. Linked from the app's onboarding URL. */
export async function GET() {
  const env = readEnv();
  const state = createState();
  const codeVerifier = createCodeVerifier();
  const authorizationUrl = buildAuthorizationUrl(
    {
      environment: env.CW_ENVIRONMENT,
      clientId: requireEnv("CW_CLIENT_ID", env),
      redirectUri: env.CW_REDIRECT_URI,
    },
    state,
    await createCodeChallenge(codeVerifier),
  );

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(OAUTH_COOKIE.state, state, oauthCookieOptions());
  response.cookies.set(OAUTH_COOKIE.verifier, codeVerifier, oauthCookieOptions());
  return response;
}
