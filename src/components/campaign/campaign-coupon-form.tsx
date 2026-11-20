"use client";

import { useActionState } from "react";
import { submitCampaignCoupon } from "@/app/campaigns/actions";
import { Button } from "@/components/ui/button";

export function CampaignCouponForm({
  campaignId,
  operation,
  label,
  frozenAt,
}: {
  campaignId: string;
  operation: "create" | "activate" | "mark_invitations_sent";
  label: string;
  frozenAt?: string;
}) {
  const [message, action, pending] = useActionState(submitCampaignCoupon, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="operation" value={operation} />
      {frozenAt && <input type="hidden" name="frozenAt" value={frozenAt} />}
      <Button type="submit" disabled={pending}>
        {pending ? "Aguarde…" : label}
      </Button>
      {message && (
        <p role="alert" className="text-peach-ink bg-peach rounded-well p-3 text-sm">
          {message}
        </p>
      )}
    </form>
  );
}
