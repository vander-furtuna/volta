import { createHmac } from "node:crypto";
import { z } from "zod";
import { secretsMatch } from "./secret-compare";

export const STORE_SESSION_SECONDS = 8 * 60 * 60;

const claimsSchema = z.object({
  storeId: z.uuid(),
  userExternalId: z.number().int().positive(),
  expiresAt: z.number().int(),
});

export type StoreSessionIdentity = Omit<z.infer<typeof claimsSchema>, "expiresAt">;

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signStoreSession(identity: StoreSessionIdentity, secret: string, now = new Date()) {
  const claims = claimsSchema.parse({
    ...identity,
    expiresAt: now.getTime() + STORE_SESSION_SECONDS * 1000,
  });
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyStoreSession(token: string | undefined, secret: string, now = new Date()) {
  if (!token || !secret || token.length > 512) return null;
  const [payload, provided, extra] = token.split(".");
  if (
    !payload ||
    !provided ||
    extra !== undefined ||
    !secretsMatch(provided, signature(payload, secret))
  ) {
    return null;
  }
  try {
    const claims = claimsSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString()));
    if (claims.expiresAt <= now.getTime()) return null;
    return { storeId: claims.storeId, userExternalId: claims.userExternalId };
  } catch {
    return null;
  }
}
