import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isValidOrderWebhookToken, verifyBillingSignature } from "./webhooks";

const SECRET = "test-webhook-token";
const rawBody = '{"event":"MARKETPLACE_APP_ACCESS_UPDATED","allowed":true}';
const now = new Date("2026-11-17T22:00:00Z");
const timestamp = String(Math.floor(now.getTime() / 1000));
const sign = (ts: string, body: string) =>
  `v1=${createHmac("sha256", SECRET).update(`${ts}.${body}`).digest("hex")}`;

describe("isValidOrderWebhookToken", () => {
  it("accepts only the exact token", () => {
    expect(isValidOrderWebhookToken(SECRET, SECRET)).toBe(true);
    expect(isValidOrderWebhookToken("wrong", SECRET)).toBe(false);
    expect(isValidOrderWebhookToken(null, SECRET)).toBe(false);
    expect(isValidOrderWebhookToken(SECRET, "")).toBe(false);
  });
});

describe("verifyBillingSignature", () => {
  it("accepts a signature over timestamp and raw body", () => {
    expect(
      verifyBillingSignature({
        rawBody,
        timestamp,
        signature: sign(timestamp, rawBody),
        secret: SECRET,
        now,
      }),
    ).toEqual({
      valid: true,
    });
  });

  it("rejects a body that was re-serialized or tampered with", () => {
    const check = verifyBillingSignature({
      rawBody: rawBody.replace("true", "false"),
      timestamp,
      signature: sign(timestamp, rawBody),
      secret: SECRET,
      now,
    });
    expect(check).toEqual({ valid: false, reason: "bad_signature" });
  });

  it("rejects timestamps older than five minutes", () => {
    const old = String(Number(timestamp) - 301);
    const check = verifyBillingSignature({
      rawBody,
      timestamp: old,
      signature: sign(old, rawBody),
      secret: SECRET,
      now,
    });
    expect(check).toEqual({ valid: false, reason: "stale_timestamp" });
  });
});
