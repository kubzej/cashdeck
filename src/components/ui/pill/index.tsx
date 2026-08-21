import type * as React from "react";
import type { ReactNode } from "react";
import { Button as BaseButton } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * kubkit Pill — interactive filter/sort chip.
 * Use Badge for static status metadata; Pill is for changing a view.
 */
const pillVariants = cva(
  "focus-ring group/pill inline-flex min-h-11 shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 data-[active=true]:shadow-sm [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "",
        quiet: "",
      },
      tone: {
        neutral: "",
        positive:
          "bg-positive/10 text-positive hover:bg-positive/15 data-[active=true]:bg-positive/15",
        negative:
          "bg-negative/10 text-negative hover:bg-negative/15 data-[active=true]:bg-negative/15",
        warning:
          "bg-warning/10 text-warning hover:bg-warning/15 data-[active=true]:bg-warning/15",
        info: "bg-info/10 text-info hover:bg-info/15 data-[active=true]:bg-info/15",
      },
      size: {
        sm: "px-3 text-xs",
        default: "px-3.5 text-sm",
        lg: "min-h-12 px-4 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      tone: "neutral",
      size: "default",
    },
  },
);

const indicatorClasses = {
  positive: "bg-positive",
  negative: "bg-negative",
  warning: "bg-warning",
  info: "bg-info",
  muted: "bg-muted-foreground",
} as const;

const neutralInactiveClasses = {
  default:
    "bg-muted/45 text-muted-foreground hover:bg-muted hover:text-foreground",
  quiet:
    "bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
} as const;

export type PillDirection = "asc" | "desc";
export type PillIndicator = keyof typeof indicatorClasses;

export interface PillProps
  extends Omit<React.ComponentProps<typeof BaseButton>, "className">,
    VariantProps<typeof pillVariants> {
  className?: string;
  active?: boolean;
  count?: ReactNode;
  direction?: PillDirection;
  indicator?: PillIndicator;
  indicatorPosition?: "leading" | "trailing";
  activeClassName?: string;
  inactiveClassName?: string;
}

function Pill({
  className,
  variant,
  tone,
  size,
  active = false,
  count,
  direction,
  indicator,
  indicatorPosition = "leading",
  activeClassName,
  inactiveClassName,
  type = "button",
  children,
  ...props
}: PillProps) {
  const indicatorNode = indicator ? (
    <span
      aria-hidden
      data-slot="pill-indicator"
      className={cn(
        "size-1.5 shrink-0 rounded-full group-data-[active=true]/pill:bg-current",
        indicatorClasses[indicator],
      )}
    />
  ) : null;

  const DirectionIcon = direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <BaseButton
      data-slot="pill"
      data-active={active ? "true" : "false"}
      data-variant={variant ?? "default"}
      data-tone={tone ?? "neutral"}
      data-size={size ?? "default"}
      aria-pressed={active}
      type={type}
      className={cn(
        pillVariants({ variant, tone, size }),
        !active &&
          !inactiveClassName &&
          (tone ?? "neutral") === "neutral" &&
          neutralInactiveClasses[variant ?? "default"],
        active &&
          !activeClassName &&
          (tone ?? "neutral") === "neutral" &&
          "bg-primary text-primary-foreground",
        active ? activeClassName : inactiveClassName,
        className,
      )}
      {...props}
    >
      {indicatorNode && indicatorPosition === "leading" ? indicatorNode : null}
      {children}
      {typeof count !== "undefined" ? (
        <span
          data-slot="pill-count"
          className="text-current/70 group-data-[active=false]/pill:text-muted-foreground"
        >
          {count}
        </span>
      ) : null}
      {direction ? <DirectionIcon data-slot="pill-direction" aria-hidden /> : null}
      {indicatorNode && indicatorPosition === "trailing" ? indicatorNode : null}
    </BaseButton>
  );
}

export interface PillGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  behavior?: "wrap" | "scroll";
  bleed?: boolean;
  align?: "start" | "center" | "end";
}

function PillGroup({
  className,
  behavior = "wrap",
  bleed = false,
  align = "start",
  ...props
}: PillGroupProps) {
  return (
    <div
      data-slot="pill-group"
      data-behavior={behavior}
      data-bleed={bleed ? "true" : "false"}
      data-align={align}
      className={cn(
        "flex gap-2",
        align === "start" && "justify-start",
        align === "center" && "justify-center",
        align === "end" && "justify-end",
        behavior === "wrap" && "flex-wrap",
        behavior === "scroll" &&
          "max-w-full flex-nowrap overflow-x-auto overscroll-x-contain py-1",
        behavior === "scroll" && bleed && "-mx-4 px-4 sm:mx-0 sm:px-0",
        className,
      )}
      {...props}
    />
  );
}

export { Pill, PillGroup };
