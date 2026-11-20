import { connection, NextResponse, type NextRequest } from "next/server";
import { openSsoSession } from "@/application/installation/open-sso-session";
import { CwApiError, CwResponseError } from "@/integrations/cardapio-web/http-client";
import { createCwTokenRefresher } from "@/integrations/cardapio-web/installation";
import { OAuthError } from "@/integrations/cardapio-web/oauth";
import { createCwSsoTicketValidator, isPlausibleSsoTicket } from "@/integrations/cardapio-web/sso";
import { readEnv, requireEnv } from "@/server/config/env";
import {
  supabaseStoreCredentialsRepository,
  supabaseStoreUserRepository,
} from "@/server/database/store-repositories";
import { supabaseStoreRegistry } from "@/server/database/sync-repositories";
import { clearStoreSession, setStoreSession } from "@/server/security/store-session";

/**
 * Target of the "Acessar" button in the CW portal (the app's login_url):
 * `?ticket=ST-...&company_external_id=123`.
 * Source: https://docs.cardapioweb.com/cw-app-store/onboarding-e-acesso.md
 *
 * The single-use ticket is validated on the server with the store's own access token. On success
 * the session cookie is set and the person goes to the home screen. On any failure the previous
 * session is cleared and the home screen shows the normal "open Volta from CW" state. A rejected
 * ticket is never sent again. The ticket and tokens are never logged.
 */
export async function GET(request: NextRequest) {
  // Always run per request. Without this, a build with DEMO_MODE=true prerenders the redirect
  // below as a static response, and real sign-ins would never reach this code.
  await connection();
  const env = readEnv();
  const home = new URL("/", env.APP_URL);
  if (env.DEMO_MODE) return redirectTo(home);

  const ticket = request.nextUrl.searchParams.get("ticket") ?? "";
  const rawStoreId = request.nextUrl.searchParams.get("company_external_id") ?? "";
  const storeExternalId = /^\d{1,15}$/.test(rawStoreId) ? Number(rawStoreId) : 0;
  if (!isPlausibleSsoTicket(ticket) || storeExternalId <= 0) {
    return signedOut(home);
  }

  // Fail before consuming the single-use ticket if the session cannot be opened afterwards.
  requireEnv("SESSION_SECRET", env);
  const clientId = requireEnv("CW_CLIENT_ID", env);

  try {
    const result = await openSsoSession(
      { ticket, storeExternalId, now: new Date() },
      {
        stores: supabaseStoreRegistry,
        credentials: supabaseStoreCredentialsRepository,
        refresher: createCwTokenRefresher({ clientId, redirectUri: env.CW_REDIRECT_URI }),
        validator: createCwSsoTicketValidator({ clientId }),
        users: supabaseStoreUserRepository,
      },
    );
    if (result.status === "rejected") return signedOut(home);

    const response = redirectTo(home);
    setStoreSession(response, { storeId: result.storeId, userExternalId: result.userExternalId });
    return response;
  } catch (error) {
    // CW unavailable, refresh token refused (for example after an uninstall) or an unexpected body.
    if (
      error instanceof OAuthError ||
      error instanceof CwApiError ||
      error instanceof CwResponseError
    ) {
      return signedOut(home);
    }
    throw error;
  }
}

function redirectTo(url: URL): NextResponse {
  const response = NextResponse.redirect(url, 303);
  // The ticket is in this request's URL: keep it out of caches and of the next page's Referer.
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function signedOut(url: URL): NextResponse {
  const response = redirectTo(url);
  clearStoreSession(response);
  return response;
}
