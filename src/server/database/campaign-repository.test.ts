import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  audienceCriteriaSchema,
  offerSchema,
  resolveAudienceSaveStatus,
} from "./campaign-repository";

describe("resolveAudienceSaveStatus", () => {
  it("starts a new campaign in draft or audience_frozen", () => {
    expect(resolveAudienceSaveStatus(null, false)).toBe("draft");
    expect(resolveAudienceSaveStatus(null, true)).toBe("audience_frozen");
  });

  it("allows freezing a draft and unfreezing a frozen audience back to draft", () => {
    expect(resolveAudienceSaveStatus("draft", true)).toBe("audience_frozen");
    expect(resolveAudienceSaveStatus("audience_frozen", false)).toBe("draft");
    expect(resolveAudienceSaveStatus("audience_frozen", true)).toBe("audience_frozen");
    expect(resolveAudienceSaveStatus("creation_failed", true)).toBe("audience_frozen");
  });

  it("refuses audience edits after the coupon has been created or the campaign is active", () => {
    expect(resolveAudienceSaveStatus("coupon_created", false)).toBeNull();
    expect(resolveAudienceSaveStatus("coupon_created", true)).toBeNull();
    expect(resolveAudienceSaveStatus("active", true)).toBeNull();
    expect(resolveAudienceSaveStatus("invitations_sent", true)).toBeNull();
    expect(resolveAudienceSaveStatus("closed", false)).toBeNull();
  });
});

describe("campaign repository schemas", () => {
  it("validates audience criteria and offer payloads", () => {
    expect(
      audienceCriteriaSchema.parse({
        minCompletedOrders: 3,
        minDaysSinceLastOrder: 30,
        minDaysBetweenInvitations: 14,
      }),
    ).toEqual({
      minCompletedOrders: 3,
      minDaysSinceLastOrder: 30,
      minDaysBetweenInvitations: 14,
    });

    expect(
      offerSchema.parse({
        benefit: "fixed_amount",
        amount: 10,
        minimumOrderValue: 50,
        usageLimit: 20,
        oncePerCustomer: true,
        newCustomersOnly: false,
        couponCode: "VOLTA10",
        channels: ["delivery"],
        startsOn: "2026-11-20",
        endsOn: "2026-11-25",
      }),
    ).toMatchObject({ couponCode: "VOLTA10", usageLimit: 20 });
  });
});
