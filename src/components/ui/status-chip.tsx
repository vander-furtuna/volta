import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { CAMPAIGN_STATUS_LABEL } from "@/copy/pt-BR";
import { STATUS_TONE, type CampaignStatus } from "@/domain/campaign/campaign-status";
import { cn } from "@/lib/utils";

const statusChipVariants = cva(
  "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold leading-none whitespace-nowrap",
  {
    variants: {
      tone: {
        draft: "bg-status-draft text-status-draft-ink",
        pending: "bg-status-pending text-status-pending-ink",
        active: "bg-status-active text-status-active-ink",
        closed: "bg-status-closed text-status-closed-ink",
        paused: "bg-status-paused text-status-paused-ink",
      },
    },
    defaultVariants: { tone: "draft" },
  },
);

type StatusChipProps = Omit<ComponentProps<"span">, "children"> &
  VariantProps<typeof statusChipVariants> & { label: string };

/** Generic status chip. The dot plus the label keep meaning independent of color. */
function StatusChip({ tone, label, className, ...props }: StatusChipProps) {
  return (
    <span
      data-slot="status-chip"
      className={cn(statusChipVariants({ tone }), className)}
      {...props}
    >
      <i aria-hidden="true" className="block size-[7px] rounded-full bg-current" />
      {label}
    </span>
  );
}

/** Campaign status chip: tone and pt-BR label come from the campaign status. */
function CampaignStatusChip({
  status,
  ...props
}: Omit<StatusChipProps, "tone" | "label"> & { status: CampaignStatus }) {
  return <StatusChip tone={STATUS_TONE[status]} label={CAMPAIGN_STATUS_LABEL[status]} {...props} />;
}

export { CampaignStatusChip, StatusChip, statusChipVariants };
