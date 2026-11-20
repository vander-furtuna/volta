"use client";

import { useSyncExternalStore } from "react";
import { buildAudience, type CustomerSummary } from "@/domain/audience/audience";
import {
  transition,
  type CampaignEvent,
  type CampaignStatus,
} from "@/domain/campaign/campaign-status";
import type { Offer } from "@/domain/offer/offer";
import { DEFAULT_CRITERIA, DEMO_CUSTOMERS, DEMO_NOW, DEMO_OFFER } from "@/demo/wizard-fixture";

/**
 * Demo-mode state of the campaign being built (audience → offer → review → coupon created).
 * Lives in sessionStorage so going back and forth, or reloading a step, keeps the manager's
 * choices. Nothing here talks to CW: in demo mode the coupon is never really created.
 *
 * Usage (client components only):
 *   const draft = useCampaignDraft();
 *   draft.offer, draft.status, draft.removedCustomerIds
 *   updateCampaignDraft({ offer }) · toggleCustomer(id) · setAllCustomers(true|false)
 *   createDemoCoupon() · dispatchCampaignEvent({ type: "activate" }) · resetCampaignDraft()
 * Derived audience: useDraftAudience().
 */

export interface CampaignDraft {
  offer: Offer;
  /** Customers the manager unchecked on the audience screen. Everyone else stays in. */
  removedCustomerIds: number[];
  status: CampaignStatus;
}

const STORAGE_KEY = "volta:campaign-draft:v1";

const INITIAL_DRAFT: CampaignDraft = {
  offer: DEMO_OFFER,
  removedCustomerIds: [],
  status: "draft",
};

/** Customers that pass the criteria and exclusions, before manual unchecking. Fixed for the demo. */
export const DRAFT_ELIGIBLE_CUSTOMERS: readonly CustomerSummary[] = buildAudience(
  DEMO_CUSTOMERS,
  DEFAULT_CRITERIA,
  DEMO_NOW,
).included;

let current: CampaignDraft | null = null;
const listeners = new Set<() => void>();

function load(): CampaignDraft {
  if (current) return current;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    current = raw ? { ...INITIAL_DRAFT, ...(JSON.parse(raw) as Partial<CampaignDraft>) } : null;
  } catch {
    current = null;
  }
  current ??= INITIAL_DRAFT;
  return current;
}

function save(next: CampaignDraft) {
  current = next;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked (private mode): the draft still works for this page view.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCampaignDraft(): CampaignDraft {
  return useSyncExternalStore(subscribe, load, () => INITIAL_DRAFT);
}

export function updateCampaignDraft(patch: Partial<CampaignDraft>) {
  save({ ...load(), ...patch });
}

export function toggleCustomer(customerId: number) {
  const { removedCustomerIds } = load();
  updateCampaignDraft({
    removedCustomerIds: removedCustomerIds.includes(customerId)
      ? removedCustomerIds.filter((id) => id !== customerId)
      : [...removedCustomerIds, customerId],
  });
}

export function setAllCustomers(selected: boolean) {
  updateCampaignDraft({
    removedCustomerIds: selected ? [] : DRAFT_ELIGIBLE_CUSTOMERS.map((customer) => customer.id),
  });
}

/** Applies a lifecycle event through the domain state machine (throws on invalid transitions). */
export function dispatchCampaignEvent(event: CampaignEvent) {
  const draft = load();
  save({ ...draft, status: transition(draft.status, event) });
}

/**
 * Review confirmation in demo mode: freezes the audience and records the (simulated) inactive
 * coupon. Starting over from a campaign that already has a coupon begins a fresh draft status.
 */
export function createDemoCoupon() {
  const draft = load();
  let status = transition("draft", { type: "freeze_audience" });
  status = transition(status, { type: "coupon_created", couponId: 48213 });
  save({ ...draft, status });
}

export function resetCampaignDraft() {
  save(INITIAL_DRAFT);
}

export function useDraftAudience() {
  const { removedCustomerIds } = useCampaignDraft();
  const removed = new Set(removedCustomerIds);
  const selected = DRAFT_ELIGIBLE_CUSTOMERS.filter((customer) => !removed.has(customer.id));
  return {
    eligible: DRAFT_ELIGIBLE_CUSTOMERS,
    selected,
    selectedCount: selected.length,
    isSelected: (customerId: number) => !removed.has(customerId),
  };
}
