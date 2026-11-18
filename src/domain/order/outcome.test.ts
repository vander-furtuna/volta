import { describe, expect, it } from "vitest";
import { outcomeFromStatus } from "./outcome";

describe("outcomeFromStatus", () => {
  it("treats closed orders as completed and canceled orders as canceled", () => {
    expect(outcomeFromStatus("closed")).toBe("completed");
    expect(outcomeFromStatus("canceled")).toBe("canceled");
  });

  it("keeps every other status open, including delivered and canceling", () => {
    for (const status of ["waiting_confirmation", "confirmed", "delivered", "canceling"]) {
      expect(outcomeFromStatus(status)).toBe("open");
    }
  });
});
