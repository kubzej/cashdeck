import { useRender } from "@base-ui/react/use-render";
import { cn } from "@/lib/utils";

type SeparatorOrientation = "horizontal" | "vertical";

/**
 * kubkit Separator — a subtle structural divider.
 * Decorative by default; opt into semantics only when the division carries meaning.
 */
export interface SeparatorProps
  extends Omit<useRender.ComponentProps<"div">, "className"> {
  orientation?: SeparatorOrientation;
  decorative?: boolean;
  className?: string;
}

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  render,
  role,
  "aria-hidden": ariaHidden,
  "aria-orientation": ariaOrientation,
  ...props
}: SeparatorProps) {
  const accessibilityProps = decorative
    ? {
        role: role ?? "none",
        "aria-hidden": ariaHidden ?? true,
      }
    : {
        role: role ?? "separator",
        "aria-orientation": ariaOrientation ?? orientation,
      };

  return useRender({
    defaultTagName: "div",
    render,
    props: {
      "data-slot": "separator",
      "data-orientation": orientation,
      className: cn(
        "shrink-0 bg-muted-foreground/20 dark:bg-muted-foreground/25",
        "data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full",
        "data-[orientation=vertical]:min-h-4 data-[orientation=vertical]:w-px data-[orientation=vertical]:self-stretch",
        className,
      ),
      ...props,
      ...accessibilityProps,
    },
  });
}

export { Separator };
