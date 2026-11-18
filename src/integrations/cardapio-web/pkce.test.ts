import { describe, expect, it } from "vitest";
import { createCodeChallenge, createCodeVerifier, createState } from "./pkce";

describe("PKCE", () => {
  it("creates verifiers within the 43–128 character range", () => {
    expect(createCodeVerifier()).toHaveLength(64);
    expect(() => createCodeVerifier(42)).toThrow(RangeError);
  });

  it("matches the RFC 7636 S256 test vector", async () => {
    const challenge = await createCodeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("creates url-safe states", () => {
    expect(createState()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
