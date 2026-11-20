import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Toggle pill used in filter groups ("Todas", "Rascunhos"...). 36 px tall like the templates,
 * with an invisible hit area extended to 44 px.
 */
export function FilterPill({
  pressed,
  className,
  ...props
}: Omit<ComponentProps<"button">, "type"> & { pressed: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "bg-surface border-border text-ink relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm leading-none font-medium",
        "before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
        "aria-pressed:bg-forest aria-pressed:border-forest aria-pressed:text-white",
        className,
      )}
      {...props}
    />
  );
}
