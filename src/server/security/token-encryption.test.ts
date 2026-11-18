import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./token-encryption";

const key = randomBytes(32).toString("base64");

describe("token encryption", () => {
  it("round-trips a secret", () => {
    const encrypted = encryptSecret("refresh-token-value", key);
    expect(encrypted).not.toContain("refresh-token-value");
    expect(decryptSecret(encrypted, key)).toBe("refresh-token-value");
  });

  it("fails with the wrong key", () => {
    const encrypted = encryptSecret("secret", key);
    expect(() => decryptSecret(encrypted, randomBytes(32).toString("base64"))).toThrow();
  });

  it("rejects keys that are not 32 bytes", () => {
    expect(() => encryptSecret("secret", Buffer.from("short").toString("base64"))).toThrow(
      /32 bytes/,
    );
  });
});
