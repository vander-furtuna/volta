import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Exception card from design/templates/source/states.dc.html: icon tile, eyebrow, title,
 * explanation and the next step.
 */

const ICON_TONE = {
  active: "bg-mint text-status-active-ink",
  draft: "bg-status-draft text-status-draft-ink",
  pending: "bg-peach text-status-pending-ink",
} as const;

export function StateIcon({
  tone,
  children,
  strokeWidth = 2,
}: {
  tone: keyof typeof ICON_TONE;
  children: ReactNode;
  strokeWidth?: number;
}) {
  return (
    <span
      className={cn(
        "rounded-well flex size-12 shrink-0 items-center justify-center",
        ICON_TONE[tone],
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="size-6"
      >
        {children}
      </svg>
    </span>
  );
}

export function StateCard({
  icon,
  eyebrow,
  title,
  titleId,
  children,
  actions,
  className,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  titleId: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "bg-surface border-border rounded-card flex flex-col gap-3.5 border p-7",
        className,
      )}
    >
      {icon}
      <span className="text-graphite text-[13px]">{eyebrow}</span>
      <h2 id={titleId} className="font-heading text-[21px] leading-[1.25] font-semibold">
        {title}
      </h2>
      {children}
      {actions && <div className="mt-auto flex flex-wrap gap-2.5">{actions}</div>}
    </section>
  );
}

export function StateText({ children }: { children: ReactNode }) {
  return <p className="text-graphite text-[15px] leading-[1.55]">{children}</p>;
}
