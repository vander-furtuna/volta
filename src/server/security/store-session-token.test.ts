import { describe, expect, it } from "vitest";
import { signStoreSession, verifyStoreSession } from "./store-session-token";

const identity = { storeId: "3c231da2-758d-4eed-89f8-fdf1efd6eb20", userExternalId: 42 };
const secret = "test-session-secret";
const now = new Date("2026-11-20T12:00:00Z");

describe("store session token", () => {
  it("binds the store and user to the signature", () => {
    const token = signStoreSession(identity, secret, now);
    expect(verifyStoreSession(token, secret, now)).toEqual(identity);
    expect(verifyStoreSession(token, "different-secret", now)).toBeNull();

    const [payload, signature] = token.split(".");
    const changed = Buffer.from(
      Buffer.from(payload!, "base64url")
        .toString()
        .replace('"userExternalId":42', '"userExternalId":43'),
    ).toString("base64url");
    expect(verifyStoreSession(`${changed}.${signature}`, secret, now)).toBeNull();
  });

  it("rejects absent, malformed and expired cookies", () => {
    expect(verifyStoreSession(undefined, secret, now)).toBeNull();
    expect(verifyStoreSession("invalid", secret, now)).toBeNull();
    const token = signStoreSession(identity, secret, now);
    expect(verifyStoreSession(token, secret, new Date("2026-11-20T20:00:00Z"))).toBeNull();
  });
});
