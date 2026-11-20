import { describe, expect, it } from "vitest";
import { buildAudience } from "@/domain/audience/audience";
import { canProceedToReview, discountExposure } from "@/domain/offer/offer";
import {
  DAYS_SINCE_LAST_ORDER_BUCKETS,
  DEFAULT_CRITERIA,
  DEMO_AUDIENCE_SIZE,
  DEMO_CUSTOMERS,
  DEMO_NOW,
  DEMO_OFFER,
  DEMO_OFFER_CONTEXT,
} from "./wizard-fixture";

describe("wizard demo fixture", () => {
  it("matches the numbers shown in the audience template", () => {
    const audience = buildAudience(DEMO_CUSTOMERS, DEFAULT_CRITERIA, DEMO_NOW);
    expect(audience.frequentCustomers).toBe(214);
    expect(audience.orderedRecently).toBe(162);
    expect(audience.opportunity).toBe(52);
    expect(audience.exclusions.map((entry) => entry.count)).toEqual([6, 3, 5]);
    expect(audience.included).toHaveLength(DEMO_AUDIENCE_SIZE);
  });

  it("has one dot per frequent customer in the home chart", () => {
    const total = DAYS_SINCE_LAST_ORDER_BUCKETS.reduce((sum, count) => sum + count, 0);
    expect(total).toBe(DEMO_CUSTOMERS.length);
  });

  it("uses a valid default offer that costs at most R$ 200", () => {
    expect(canProceedToReview(DEMO_OFFER, DEMO_OFFER_CONTEXT)).toBe(true);
    expect(discountExposure(DEMO_OFFER, DEMO_OFFER_CONTEXT).amount).toBe(200);
  });
});
