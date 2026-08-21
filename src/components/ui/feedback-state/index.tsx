import type { HTMLAttributes } from "react";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * kubkit FeedbackState — status-driven block for the operational state of a
 * region: loading, error, success, info/pending. Soft-fill, borderless.
 *
 * Differs from Alert (an inline message *beside* content) and EmptyState (a calm
 * neutral "nothing here yet" fallback): FeedbackState reflects what is happening
 * or what just happened, tinted by `status`, and offers an `inline` layout for
 * compact status rows ("Saving…", "Couldn't load · Retry").
 *
 * Icons and actions are explicit composition parts — no hidden action-object API.
 */
const feedbackStateVariants = cva(
  "flex w-full rounded-lg text-sm text-foreground [&_[data-slot=feedback-state-icon]]:text-muted-foreground",
  {
    variants: {
      status: {
        neutral: "",
        loading: "",
        info: "[&_[data-slot=feedback-state-icon]]:text-info",
        success: "[&_[data-slot=feedback-state-icon]]:text-positive",
        error: "[&_[data-slot=feedback-state-icon]]:text-destructive",
      },
      layout: {
        page: "flex-col items-center gap-4 bg-muted/30 px-6 py-16 text-center sm:py-24",
        panel: "flex-col items-center gap-4 bg-muted/30 px-6 py-11 text-center",
        inline:
          "flex-row items-center gap-3 bg-muted/40 px-4 py-3 text-left [&_[data-slot=feedback-state-actions]]:ml-auto [&_[data-slot=feedback-state-content]]:min-w-0 [&_[data-slot=feedback-state-icon]_svg]:size-5",
      },
    },
    defaultVariants: {
      status: "neutral",
      layout: "panel",
    },
  },
);

export interface FeedbackStateProps
  extends Omit<useRender.ComponentProps<"div">, "className">,
    VariantProps<typeof feedbackStateVariants> {
  className?: string;
}

function FeedbackState({
  className,
  status,
  layout,
  render,
  role,
  ...props
}: FeedbackStateProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      "data-slot": "feedback-state",
      "data-status": status ?? "neutral",
      "data-layout": layout ?? "panel",
      role: role ?? (status === "error" ? "alert" : "status"),
      className: cn(feedbackStateVariants({ status, layout }), className),
      ...props,
    },
  });
}

export interface FeedbackStatePartProps extends HTMLAttributes<HTMLDivElement> {
  render?: useRender.RenderProp;
}

function FeedbackStateIcon({
  className,
  render,
  ...props
}: FeedbackStatePartProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      "data-slot": "feedback-state-icon",
      className: cn(
        "inline-flex shrink-0 items-center justify-center [&_svg]:size-6 [&_svg]:shrink-0",
        className,
      ),
      ...props,
    },
  });
}

function FeedbackStateContent({
  className,
  render,
  ...props
}: FeedbackStatePartProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      "data-slot": "feedback-state-content",
      className: cn("flex flex-col gap-1", className),
      ...props,
    },
  });
}

function FeedbackStateTitle({
  className,
  render,
  ...props
}: FeedbackStatePartProps) {
  return useRender({
    defaultTagName: "h3",
    render,
    props: {
      "data-slot": "feedback-state-title",
      className: cn("text-base font-semibold leading-6 text-foreground", className),
      ...props,
    },
  });
}

function FeedbackStateDescription({
  className,
  render,
  ...props
}: FeedbackStatePartProps) {
  return useRender({
    defaultTagName: "p",
    render,
    props: {
      "data-slot": "feedback-state-description",
      className: cn(
        "max-w-md text-sm leading-relaxed text-muted-foreground",
        className,
      ),
      ...props,
    },
  });
}

function FeedbackStateActions({
  className,
  render,
  ...props
}: FeedbackStatePartProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      "data-slot": "feedback-state-actions",
      className: cn(
        "flex flex-col gap-2 pt-1 sm:flex-row sm:items-center [&>*]:w-full sm:[&>*]:w-auto",
        className,
      ),
      ...props,
    },
  });
}

export {
  FeedbackState,
  FeedbackStateIcon,
  FeedbackStateContent,
  FeedbackStateTitle,
  FeedbackStateDescription,
  FeedbackStateActions,
};
