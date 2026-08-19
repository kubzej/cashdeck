import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * kubkit Badge — compact status/metadata pill for dense product surfaces.
 * Token-only. Use `size="xs"` for table/status pills instead of arbitrary overrides.
 */
const badgeVariants = cva(
  "focus-ring inline-flex w-fit shrink-0 items-center justify-center overflow-hidden whitespace-nowrap rounded-full font-medium transition-[background-color,border-color,color,box-shadow] [&>svg]:pointer-events-none [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive: "bg-destructive/10 text-destructive [a&]:hover:bg-destructive/15",
        muted:
          "bg-muted/50 text-muted-foreground [a&]:hover:bg-muted [a&]:hover:text-foreground",
        outline:
          "border border-border/70 bg-transparent text-foreground [a&]:hover:bg-muted/50",
        ghost: "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
        positive: "bg-positive/10 text-positive [a&]:hover:bg-positive/15",
        negative: "bg-negative/10 text-negative [a&]:hover:bg-negative/15",
        warning: "bg-warning/10 text-warning [a&]:hover:bg-warning/15",
        info: "bg-info/10 text-info [a&]:hover:bg-info/15",
      },
      size: {
        xs: "h-5 gap-1 px-1.5 text-xs leading-none [&>svg]:size-3",
        sm: "h-6 gap-1 px-2 text-xs leading-none [&>svg]:size-3",
        default: "h-7 gap-1.5 px-2.5 text-xs leading-none [&>svg]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface BadgeProps
  extends Omit<useRender.ComponentProps<"span">, "className">,
    VariantProps<typeof badgeVariants> {
  className?: string;
}

function Badge({ className, variant, size, render, ...props }: BadgeProps) {
  return useRender({
    defaultTagName: "span",
    render,
    props: {
      "data-slot": "badge",
      "data-variant": variant ?? "default",
      "data-size": size ?? "default",
      className: cn(badgeVariants({ variant, size }), className),
      ...props,
    },
  });
}

export { Badge, badgeVariants };
