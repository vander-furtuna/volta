interface CouponCreation {
  findByCode(): Promise<{ id: number; matches: boolean } | null>;
  reserveCreation(): Promise<boolean>;
  create(): Promise<number>;
  confirm(id: number): Promise<void>;
}

/** Reserves a single outbound create, then lets retries reconcile an uncertain CW response. */
export async function createCampaignCoupon(previouslySent: boolean, deps: CouponCreation) {
  const existing = await deps.findByCode();
  if (existing) {
    if (!previouslySent || !existing.matches) return "conflict";
    await deps.confirm(existing.id);
    return "created";
  }

  // shortcut: CW has no documented idempotency key, retry POST once it can guarantee deduplication.
  if (previouslySent || !(await deps.reserveCreation())) return "pending";

  await deps.confirm(await deps.create());
  return "created";
}
