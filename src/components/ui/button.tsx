import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Pill buttons from the Volta design system (design/templates/html/design-system.html).
 * Rule: exactly one `primary` per screen. For links, use `asChild` with next/link.
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-full whitespace-nowrap",
    "font-semibold leading-none no-underline transition-colors duration-150",
    "disabled:pointer-events-none disabled:opacity-60",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        primary: "bg-ember text-white hover:bg-ember-deep",
        dark: "bg-forest text-white hover:bg-forest-deep",
        outline:
          "bg-surface text-forest shadow-[inset_0_0_0_1.5px_var(--color-border-input)] hover:shadow-[inset_0_0_0_1.5px_var(--color-forest)]",
        onDark:
          "bg-transparent text-white shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.45)] hover:bg-white/10",
        ghost: "text-forest hover:bg-well",
        link: "rounded-none px-0 text-forest underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-12 px-[22px] text-[15px]",
        compact: "min-h-11 px-4 text-sm",
        icon: "size-11",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Renders the child element (e.g. next/link) with button styles. */
    asChild?: boolean;
  };

function Button({
  className,
  variant,
  size,
  fullWidth,
  asChild = false,
  type,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot.Root : "button";
  return (
    <Component
      data-slot="button"
      data-variant={variant ?? "primary"}
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants, type ButtonProps };
