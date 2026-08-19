import type { HTMLAttributes } from "react";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * kubkit List — dense repeated rows for queues, settings, files, and activity.
 * Use Card for one framed object and Table for comparable columns.
 */
const listVariants = cva("flex w-full min-w-0 flex-col", {
  variants: {
    gap: {
      sm: "gap-1.5",
      default: "gap-2",
      lg: "gap-3",
    },
  },
  defaultVariants: {
    gap: "default",
  },
});

const listItemVariants = cva(
  "group/list-item flex w-full min-w-0 items-start gap-3 rounded-lg text-left text-sm transition-colors data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-muted/35",
        quiet: "bg-transparent",
        filled: "bg-muted/55",
      },
      size: {
        compact: "min-h-11 px-3 py-2",
        default: "min-h-14 px-4 py-3",
        spacious: "min-h-16 px-4 py-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const leadingVariants = cva(
  "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "bg-background/70 text-muted-foreground",
        positive: "bg-positive/10 text-positive",
        negative: "bg-negative/10 text-negative",
        warning: "bg-warning/10 text-warning",
        info: "bg-info/10 text-info",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export interface ListProps
  extends Omit<useRender.ComponentProps<"div">, "className">,
    VariantProps<typeof listVariants> {
  className?: string;
}

function List({ className, gap, render, role, ...props }: ListProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      "data-slot": "list",
      "data-gap": gap ?? "default",
      role: role ?? (render ? undefined : "list"),
      className: cn(listVariants({ gap }), className),
      ...props,
    },
  });
}

export interface ListItemProps
  extends Omit<useRender.ComponentProps<"div">, "className">,
    VariantProps<typeof listItemVariants> {
  className?: string;
  interactive?: boolean;
  selected?: boolean;
  disabled?: boolean;
}

function ListItem({
  className,
  variant,
  size,
  interactive = false,
  selected = false,
  disabled = false,
  render,
  role,
  ...props
}: ListItemProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      "data-slot": "list-item",
      "data-variant": variant ?? "default",
      "data-size": size ?? "default",
      "data-interactive": interactive ? "true" : undefined,
      "data-selected": selected ? "true" : undefined,
      "data-disabled": disabled ? "true" : undefined,
      "aria-disabled": disabled ? true : undefined,
      role: role ?? (render ? undefined : "listitem"),
      className: cn(
        listItemVariants({ variant, size }),
        interactive && "focus-ring cursor-pointer hover:bg-muted/55",
        selected && "bg-muted/70 shadow-sm",
        className,
      ),
      ...props,
    },
  });
}

export interface ListItemLeadingProps
  extends Omit<useRender.ComponentProps<"div">, "className">,
    VariantProps<typeof leadingVariants> {
  className?: string;
}

function ListItemLeading({
  className,
  tone,
  render,
  ...props
}: ListItemLeadingProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      "data-slot": "list-item-leading",
      "data-tone": tone ?? "neutral",
      className: cn(leadingVariants({ tone }), className),
      ...props,
    },
  });
}

function ListItemContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="list-item-content"
      className={cn("grid min-w-0 flex-1 gap-1", className)}
      {...props}
    />
  );
}

function ListItemTitle({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="list-item-title"
      className={cn("min-w-0 font-medium leading-5 text-foreground", className)}
      {...props}
    />
  );
}

function ListItemDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="list-item-description"
      className={cn(
        "min-w-0 text-sm leading-5 text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function ListItemMeta({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="list-item-meta"
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-4 text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function ListItemActions({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="list-item-actions"
      className={cn("ml-auto flex shrink-0 items-center gap-1 self-center", className)}
      {...props}
    />
  );
}

export {
  List,
  ListItem,
  ListItemLeading,
  ListItemContent,
  ListItemTitle,
  ListItemDescription,
  ListItemMeta,
  ListItemActions,
};
