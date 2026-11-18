import { describe, expect, it } from "vitest";
import { secretsMatch } from "./secret-compare";

describe("secretsMatch", () => {
  it("accepts an exact match", () => {
    expect(secretsMatch("abc123", "abc123")).toBe(true);
  });

  it("rejects a different value, a prefix, or a missing value", () => {
    expect(secretsMatch("abc124", "abc123")).toBe(false);
    expect(secretsMatch("abc", "abc123")).toBe(false);
    expect(secretsMatch(null, "abc123")).toBe(false);
  });

  it("never matches when the expected secret is not configured", () => {
    expect(secretsMatch("", "")).toBe(false);
    expect(secretsMatch("anything", "")).toBe(false);
  });
});
