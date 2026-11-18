/**
 * PKCE (RFC 7636) with the S256 method, required by CW.
 * The code verifier never goes into a URL: it stays on the server until the code exchange.
 */

const VERIFIER_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
const MIN_VERIFIER_LENGTH = 43;
const MAX_VERIFIER_LENGTH = 128;
const DEFAULT_VERIFIER_LENGTH = 64;
const STATE_BYTES = 32;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function createCodeVerifier(length = DEFAULT_VERIFIER_LENGTH): string {
  if (length < MIN_VERIFIER_LENGTH || length > MAX_VERIFIER_LENGTH) {
    throw new RangeError(
      `Code verifier length must be between ${MIN_VERIFIER_LENGTH} and ${MAX_VERIFIER_LENGTH}.`,
    );
  }
  const randomBytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(randomBytes, (byte) => VERIFIER_ALPHABET[byte % VERIFIER_ALPHABET.length]).join(
    "",
  );
}

export async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return toBase64Url(new Uint8Array(digest));
}

/** Random, opaque `state`. Validate it on the callback: issued by us, not expired, not reused. */
export function createState(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(STATE_BYTES)));
}
