import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** On/off switch (button role="switch"). Label it with `aria-labelledby` or `aria-label`. */
export function Switch({
  checked,
  onCheckedChange,
  className,
  ...props
}: Omit<ComponentProps<"button">, "type" | "role" | "onClick"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "bg-graphite/45 aria-checked:bg-forest relative h-[30px] w-[52px] flex-none rounded-full",
        "before:absolute before:inset-x-0 before:-inset-y-[7px] before:content-['']",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-[3px] left-[3px] size-6 rounded-full bg-white transition-transform duration-150",
          checked && "translate-x-[22px]",
        )}
      />
    </button>
  );
}
