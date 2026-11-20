import { describe, expect, it } from "vitest";
import { isAccessAllowed } from "./store-access";

const now = new Date("2026-11-20T12:00:00Z");

describe("isAccessAllowed", () => {
  it("blocks a store that has no access state yet, as during activation", () => {
    expect(isAccessAllowed(null, now)).toBe(false);
  });

  it("allows access with no time limit when access_until is null", () => {
    expect(isAccessAllowed({ allowed: true, accessUntil: null }, now)).toBe(true);
  });

  it("allows access before access_until", () => {
    const accessUntil = new Date(now.getTime() + 1);
    expect(isAccessAllowed({ allowed: true, accessUntil }, now)).toBe(true);
  });

  it("treats access_until as exclusive: the instant itself is already blocked", () => {
    expect(isAccessAllowed({ allowed: true, accessUntil: now }, now)).toBe(false);
    const past = new Date(now.getTime() - 1);
    expect(isAccessAllowed({ allowed: true, accessUntil: past }, now)).toBe(false);
  });

  it("blocks when allowed is false, even with a future access_until", () => {
    const future = new Date(now.getTime() + 86_400_000);
    expect(isAccessAllowed({ allowed: false, accessUntil: future }, now)).toBe(false);
    expect(isAccessAllowed({ allowed: false, accessUntil: null }, now)).toBe(false);
  });
});
