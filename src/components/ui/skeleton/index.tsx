import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * kubkit Skeleton — decorative loading placeholder. Token-only.
 * Use className for layout dimensions only; color, radius, and motion stay here.
 */
const skeletonVariants = cva(
  "pointer-events-none relative overflow-hidden bg-muted-foreground/15 text-transparent select-none dark:bg-muted-foreground/20",
  {
    variants: {
      shape: {
        line: "h-4 w-full rounded-full",
        block: "min-h-24 w-full rounded-lg",
        circle: "size-10 rounded-full",
        pill: "h-7 w-24 rounded-full",
      },
      animated: {
        true: "motion-safe:animate-pulse",
        false: "",
      },
    },
    defaultVariants: {
      shape: "line",
      animated: true,
    },
  },
);

export interface SkeletonProps
  extends Omit<useRender.ComponentProps<"div">, "className">,
    VariantProps<typeof skeletonVariants> {
  className?: string;
}

function Skeleton({
  className,
  shape,
  animated,
  render,
  ...props
}: SkeletonProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      "aria-hidden": props["aria-hidden"] ?? true,
      "data-slot": "skeleton",
      "data-shape": shape ?? "line",
      className: cn(skeletonVariants({ shape, animated }), className),
      ...props,
    },
  });
}

export { Skeleton };
