import { describe, expect, it } from "vitest";
import {
  allowedEvents,
  InvalidTransitionError,
  transition,
  type CampaignStatus,
} from "./campaign-status";

describe("campaign status", () => {
  it("follows the happy path from draft to invitations sent", () => {
    let status: CampaignStatus = "draft";
    status = transition(status, { type: "freeze_audience" });
    status = transition(status, { type: "coupon_created", couponId: 48213 });
    status = transition(status, { type: "activate" });
    status = transition(status, { type: "mark_invitations_sent" });
    expect(status).toBe("invitations_sent");
  });

  it("never lets invitations be marked before the coupon is active", () => {
    expect(() => transition("coupon_created", { type: "mark_invitations_sent" })).toThrow(
      InvalidTransitionError,
    );
  });

  it("returns to the frozen audience after a failed creation is retried", () => {
    const failed = transition("audience_frozen", {
      type: "coupon_creation_failed",
      reason: "timeout",
    });
    expect(failed).toBe("creation_failed");
    expect(transition(failed, { type: "retry_creation" })).toBe("audience_frozen");
  });

  it("treats closed as final", () => {
    expect(allowedEvents("closed")).toEqual([]);
  });
});
