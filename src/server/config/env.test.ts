import { describe, expect, it } from "vitest";
import { readEnv } from "./env";

describe("readEnv DEMO_MODE", () => {
  it("is off when the variable is not set, so production never runs in demo by accident", () => {
    expect(readEnv({}).DEMO_MODE).toBe(false);
  });

  it("is on only when set explicitly to true", () => {
    expect(readEnv({ DEMO_MODE: "true" }).DEMO_MODE).toBe(true);
    expect(readEnv({ DEMO_MODE: "false" }).DEMO_MODE).toBe(false);
  });

  it("rejects any other value instead of guessing", () => {
    expect(() => readEnv({ DEMO_MODE: "yes" })).toThrow();
    expect(() => readEnv({ DEMO_MODE: "1" })).toThrow();
  });
});
