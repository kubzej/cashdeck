import type { HTMLAttributes } from "react";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * kubkit Card — grouped content surface with explicit header/content/footer parts.
 * Borderless by default; separation comes from fill, spacing, and shadow.
 */
const cardVariants = cva(
  "flex flex-col overflow-hidden rounded-lg text-card-foreground transition data-[interactive=true]:focus-ring data-[interactive=true]:cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-card shadow-sm",
        muted: "bg-muted/40 shadow-none",
        elevated: "bg-card shadow-lg",
      },
      tone: {
        default: "",
        positive: "bg-positive/8 dark:bg-positive/14",
        negative: "bg-negative/8 dark:bg-negative/14",
        warning: "bg-warning/10 dark:bg-warning/15",
        info: "bg-info/10 dark:bg-info/15",
      },
      padding: {
        none: "",
        sm: "py-4",
        default: "py-5",
        lg: "py-6",
      },
    },
    defaultVariants: {
      variant: "default",
      tone: "default",
      padding: "default",
    },
  },
);

export interface CardProps
  extends Omit<useRender.ComponentProps<"div">, "className">,
    VariantProps<typeof cardVariants> {
  className?: string;
  interactive?: boolean;
}

function Card({
  className,
  variant,
  tone,
  padding,
  interactive = false,
  render,
  ...props
}: CardProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      "data-slot": "card",
      "data-variant": variant ?? "default",
      "data-tone": tone ?? "default",
      "data-padding": padding ?? "default",
      "data-interactive": interactive ? "true" : undefined,
      className: cn(cardVariants({ variant, tone, padding }), className),
      ...props,
    },
  });
}

function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "grid auto-rows-min grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 px-5",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      data-slot="card-title"
      className={cn("text-base font-semibold leading-6", className)}
      {...props}
    />
  );
}

function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardAction({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 shrink-0 self-start justify-self-end", className)}
      {...props}
    />
  );
}

function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-5", className)}
      {...props}
    />
  );
}

function CardFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "mt-auto flex flex-col-reverse gap-2 px-5 pt-4 sm:flex-row sm:items-center sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
};
