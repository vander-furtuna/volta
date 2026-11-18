/** Short-lived cookies that carry PKCE material between /start and /callback. */

export const OAUTH_COOKIE = {
  state: "volta_oauth_state",
  verifier: "volta_oauth_verifier",
} as const;

const OAUTH_COOKIE_MAX_AGE_SECONDS = 600;

export function oauthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // The CW portal returns with a top-level GET redirect, which Lax allows.
    sameSite: "lax" as const,
    path: "/api/cw/oauth",
    maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
  };
}
