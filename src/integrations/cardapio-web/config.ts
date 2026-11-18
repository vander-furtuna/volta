/**
 * Cardápio Web (CW) endpoints and limits.
 * Sources: https://docs.cardapioweb.com/autenticacao/oauth.md
 *          https://docs.cardapioweb.com/sobre-a-api.md
 */

export type CwEnvironment = "sandbox" | "production";

const ENDPOINTS = {
  sandbox: {
    authorizationPortal: "https://portal.sandbox.cardapioweb.com/cw-apps",
    api: "https://integracao.sandbox.cardapioweb.com",
  },
  production: {
    authorizationPortal: "https://portal.cardapioweb.com/cw-apps",
    api: "https://integracao.cardapioweb.com",
  },
} as const satisfies Record<CwEnvironment, { authorizationPortal: string; api: string }>;

export function cwEndpoints(environment: CwEnvironment) {
  return ENDPOINTS[environment];
}

/**
 * Rate limits apply per store (not per app or token). When several apply, the strictest wins.
 */
export const CW_RATE_LIMITS = {
  orderHistory: { requests: 5, windowMs: 60_000 },
  default: { requests: 300, windowMs: 180_000 },
} as const;

export const CW_PAGE_SIZE = {
  orderHistory: 100,
  coupons: 20,
} as const;

/** Scopes the Volta app must have in its CW registration. The portal grants every registered scope. */
export const REQUIRED_CW_SCOPES = ["auth", "customers", "orders", "coupons"] as const;
