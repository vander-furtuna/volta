/**
 * Campaign lifecycle. Creating, activating and inviting are separate steps on purpose:
 * nothing reaches customers without the manager's explicit approval.
 * Diagram and rules: docs/architecture/campaign-states.md
 */

export type CampaignStatus =
  | "draft"
  | "audience_frozen"
  | "creation_failed"
  | "coupon_created"
  | "active"
  | "invitations_sent"
  | "paused"
  | "closed";

export type CampaignEvent =
  | { type: "freeze_audience" }
  | { type: "unfreeze_audience" }
  | { type: "coupon_created"; couponId: number }
  | { type: "coupon_creation_failed"; reason: string }
  | { type: "retry_creation" }
  | { type: "activate" }
  | { type: "mark_invitations_sent" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "close" };

export type CampaignEventType = CampaignEvent["type"];

const TRANSITIONS: Record<CampaignStatus, Partial<Record<CampaignEventType, CampaignStatus>>> = {
  draft: { freeze_audience: "audience_frozen" },
  audience_frozen: {
    unfreeze_audience: "draft",
    coupon_created: "coupon_created",
    coupon_creation_failed: "creation_failed",
  },
  creation_failed: { retry_creation: "audience_frozen" },
  coupon_created: { activate: "active", close: "closed" },
  active: { mark_invitations_sent: "invitations_sent", pause: "paused", close: "closed" },
  invitations_sent: { pause: "paused", close: "closed" },
  paused: { resume: "active", close: "closed" },
  closed: {},
};

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: CampaignStatus,
    readonly event: CampaignEventType,
  ) {
    super(`Cannot apply "${event}" to a campaign in "${from}".`);
    this.name = "InvalidTransitionError";
  }
}

export function transition(from: CampaignStatus, event: CampaignEvent): CampaignStatus {
  const to = TRANSITIONS[from][event.type];
  if (!to) throw new InvalidTransitionError(from, event.type);
  return to;
}

export function allowedEvents(status: CampaignStatus): CampaignEventType[] {
  return Object.keys(TRANSITIONS[status]) as CampaignEventType[];
}

/** Visual tone of the status chip (see design/tokens.json → status). */
export type StatusTone = "draft" | "pending" | "active" | "closed" | "paused";

export const STATUS_TONE: Record<CampaignStatus, StatusTone> = {
  draft: "draft",
  audience_frozen: "draft",
  creation_failed: "pending",
  coupon_created: "draft",
  active: "pending",
  invitations_sent: "active",
  paused: "paused",
  closed: "closed",
};
