import { describe, expect, it } from "vitest";
import { previousDayInTimeZone } from "./time";

describe("previousDayInTimeZone", () => {
  it("uses the restaurant's day, not the UTC day", () => {
    // 02:00 UTC on the 18th is still the 17th in São Paulo, so the previous day is the 16th.
    expect(previousDayInTimeZone(new Date("2026-11-18T02:00:00Z"), "America/Sao_Paulo")).toBe(
      "2026-11-16",
    );
    // 15:00 UTC on the 18th is the 18th in São Paulo, so the previous day is the 17th.
    expect(previousDayInTimeZone(new Date("2026-11-18T15:00:00Z"), "America/Sao_Paulo")).toBe(
      "2026-11-17",
    );
  });

  it("crosses month and year boundaries", () => {
    expect(previousDayInTimeZone(new Date("2027-01-01T15:00:00Z"), "America/Sao_Paulo")).toBe(
      "2026-12-31",
    );
  });
});
