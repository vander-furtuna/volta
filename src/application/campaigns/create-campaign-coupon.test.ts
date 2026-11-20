import { describe, expect, it, vi } from "vitest";
import { createCampaignCoupon } from "./create-campaign-coupon";

function fakes() {
  return {
    findByCode: vi.fn().mockResolvedValue(null),
    reserveCreation: vi.fn().mockResolvedValue(true),
    create: vi.fn().mockResolvedValue(15),
    confirm: vi.fn().mockResolvedValue(undefined),
  };
}

describe("createCampaignCoupon", () => {
  it("reserves the exact inactive input before creating and confirming a coupon", async () => {
    const deps = fakes();
    await expect(createCampaignCoupon(false, deps)).resolves.toBe("created");
    expect(deps.reserveCreation).toHaveBeenCalledBefore(deps.create);
    expect(deps.create).toHaveBeenCalledOnce();
    expect(deps.confirm).toHaveBeenCalledWith(15);
  });

  it("does not use a coupon already present before the first attempt", async () => {
    const deps = fakes();
    deps.findByCode.mockResolvedValue({ id: 15, matches: true });
    await expect(createCampaignCoupon(false, deps)).resolves.toBe("conflict");
    expect(deps.reserveCreation).not.toHaveBeenCalled();
    expect(deps.confirm).not.toHaveBeenCalled();
  });

  it("recovers a matching coupon after a lost response without sending a second POST", async () => {
    const deps = fakes();
    deps.findByCode.mockResolvedValue({ id: 15, matches: true });
    await expect(createCampaignCoupon(true, deps)).resolves.toBe("created");
    expect(deps.confirm).toHaveBeenCalledWith(15);
    expect(deps.create).not.toHaveBeenCalled();
  });

  it("does not retry an ambiguous POST or adopt a coupon with different terms", async () => {
    const deps = fakes();
    await expect(createCampaignCoupon(true, deps)).resolves.toBe("pending");
    deps.findByCode.mockResolvedValue({ id: 15, matches: false });
    await expect(createCampaignCoupon(true, deps)).resolves.toBe("conflict");
    expect(deps.create).not.toHaveBeenCalled();
    expect(deps.confirm).not.toHaveBeenCalled();
  });

  it("skips the external write if another submission won the reservation", async () => {
    const deps = fakes();
    deps.reserveCreation.mockResolvedValue(false);
    await expect(createCampaignCoupon(false, deps)).resolves.toBe("pending");
    expect(deps.create).not.toHaveBeenCalled();
  });
});
