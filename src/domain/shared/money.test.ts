import { describe, expect, it } from "vitest";
import { fromCents, toCents } from "./money";

describe("money", () => {
  it("converts decimals to integer cents without floating-point drift", () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(0)).toBe(0);
  });

  it("converts cents back to decimals", () => {
    expect(fromCents(1999)).toBe(19.99);
  });

  it("rejects non-finite values and non-integer cents", () => {
    expect(() => toCents(Number.NaN)).toThrow();
    expect(() => fromCents(10.5)).toThrow();
  });
});
