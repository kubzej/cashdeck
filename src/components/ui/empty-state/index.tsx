import type { HTMLAttributes } from "react";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * kubkit EmptyState — calm fallback for empty collections, filtered results, and first-run setup.
 * Icons and actions are explicit composition parts; no hidden action object API.
 */
const emptyStateVariants = cva(
  "flex w-full flex-col rounded-lg text-sm text-foreground",
  {
    variants: {
      variant: {
        default: "bg-muted/40",
        quiet: "bg-transparent",
        tinted: "bg-secondary",
      },
      size: {
        sm: "gap-3 px-4 py-7",
        default: "gap-4 px-6 py-11",
        lg: "gap-5 px-6 py-14 sm:px-8",
      },
      align: {
        center: "items-center text-center",
        start: "items-start text-left",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      align: "center",
    },
  },
);

export interface EmptyStateProps
  extends Omit<useRender.ComponentProps<"div">, "className">,
    VariantProps<typeof emptyStateVariants> {
  className?: string;
}

function EmptyState({
  className,
  variant,
  size,
  align,
  render,
  ...props
}: EmptyStateProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      "data-slot": "empty-state",
      "data-variant": variant ?? "default",
      "data-size": size ?? "default",
      "data-align": align ?? "center",
      className: cn(emptyStateVariants({ variant, size, align }), className),
      ...props,
    },
  });
}

export interface EmptyStateIconProps extends HTMLAttributes<HTMLDivElement> {
  render?: useRender.RenderProp;
}

function EmptyStateIcon({
  className,
  render,
  ...props
}: EmptyStateIconProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      "data-slot": "empty-state-icon",
      className: cn(
        "inline-flex size-12 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-sm [&_svg]:size-6 [&_svg]:shrink-0",
        className,
      ),
      ...props,
    },
  });
}

export interface EmptyStateTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  render?: useRender.RenderProp;
}

function EmptyStateTitle({
  className,
  render,
  ...props
}: EmptyStateTitleProps) {
  return useRender({
    defaultTagName: "h3",
    render,
    props: {
      "data-slot": "empty-state-title",
      className: cn("max-w-md text-lg font-semibold leading-6", className),
      ...props,
    },
  });
}

export interface EmptyStateDescriptionProps
  extends HTMLAttributes<HTMLParagraphElement> {
  render?: useRender.RenderProp;
}

function EmptyStateDescription({
  className,
  render,
  ...props
}: EmptyStateDescriptionProps) {
  return useRender({
    defaultTagName: "p",
    render,
    props: {
      "data-slot": "empty-state-description",
      className: cn(
        "max-w-md text-sm leading-relaxed text-muted-foreground",
        className,
      ),
      ...props,
    },
  });
}

export interface EmptyStateActionsProps extends HTMLAttributes<HTMLDivElement> {
  render?: useRender.RenderProp;
}

function EmptyStateActions({
  className,
  render,
  ...props
}: EmptyStateActionsProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      "data-slot": "empty-state-actions",
      className: cn(
        "flex w-full flex-col gap-2 pt-1 sm:w-auto sm:flex-row sm:items-center sm:justify-center [&>*]:w-full sm:[&>*]:w-auto",
        className,
      ),
      ...props,
    },
  });
}

export {
  EmptyState,
  EmptyStateIcon,
  EmptyStateTitle,
  EmptyStateDescription,
  EmptyStateActions,
};
