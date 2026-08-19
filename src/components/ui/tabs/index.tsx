import type * as React from "react";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * kubkit Tabs — section switching for related panels.
 * Default tabs use a soft segmented surface; line tabs are compact and borderless.
 */
function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      orientation={orientation}
      className={cn(
        "group/tabs flex gap-4 data-[orientation=horizontal]:flex-col data-[orientation=vertical]:flex-row",
        className,
      )}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex items-center gap-1 text-muted-foreground data-[orientation=vertical]:h-fit data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
  {
    variants: {
      variant: {
        default: "flex-wrap rounded-lg bg-muted/50 p-1",
        line: "flex-wrap bg-transparent p-0",
      },
      size: {
        sm: "text-sm",
        default: "text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface TabsListProps
  extends Omit<React.ComponentProps<typeof TabsPrimitive.List>, "className">,
    VariantProps<typeof tabsListVariants> {
  className?: string;
}

function TabsList({
  className,
  variant,
  size,
  ...props
}: TabsListProps) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant ?? "default"}
      data-size={size ?? "default"}
      className={cn(tabsListVariants({ variant, size }), className)}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Tab>) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "focus-ring relative inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition disabled:pointer-events-none disabled:opacity-50 data-[active]:text-foreground data-[orientation=vertical]:w-full data-[orientation=vertical]:justify-start [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        "group-data-[variant=default]/tabs-list:data-[active]:bg-background group-data-[variant=default]/tabs-list:data-[active]:shadow-sm",
        "group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:px-2 group-data-[variant=line]/tabs-list:after:absolute group-data-[variant=line]/tabs-list:after:bg-foreground group-data-[variant=line]/tabs-list:after:opacity-0 group-data-[variant=line]/tabs-list:after:transition-opacity group-data-[variant=line]/tabs-list:data-[active]:after:opacity-100 group-data-[variant=line]/tabs-list:data-[orientation=horizontal]:after:inset-x-2 group-data-[variant=line]/tabs-list:data-[orientation=horizontal]:after:bottom-0 group-data-[variant=line]/tabs-list:data-[orientation=horizontal]:after:h-0.5 group-data-[variant=line]/tabs-list:data-[orientation=vertical]:after:inset-y-2 group-data-[variant=line]/tabs-list:data-[orientation=vertical]:after:right-0 group-data-[variant=line]/tabs-list:data-[orientation=vertical]:after:w-0.5",
        "group-data-[size=sm]/tabs-list:min-h-10 group-data-[size=sm]/tabs-list:px-2",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Panel>) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn(
        "flex-1 outline-none data-ending-style:hidden",
        className,
      )}
      {...props}
    />
  );
}

function TabsIndicator({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Indicator>) {
  return (
    <TabsPrimitive.Indicator
      data-slot="tabs-indicator"
      className={cn("hidden", className)}
      {...props}
    />
  );
}

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  TabsIndicator,
};
