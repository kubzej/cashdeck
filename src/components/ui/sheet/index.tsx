import type * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type SheetSide = "top" | "right" | "bottom" | "left";

const sheetSideClasses: Record<SheetSide, string> = {
  top: "left-1/2 top-0 w-full max-h-dvh -translate-x-1/2 rounded-b-lg data-ending-style:-translate-y-full data-starting-style:-translate-y-full",
  right:
    "inset-y-0 right-0 h-dvh w-full rounded-l-lg sm:max-w-md data-ending-style:translate-x-full data-starting-style:translate-x-full",
  bottom:
    "bottom-0 left-1/2 w-full max-h-dvh -translate-x-1/2 rounded-t-lg data-ending-style:translate-y-full data-starting-style:translate-y-full",
  left:
    "inset-y-0 left-0 h-dvh w-full rounded-r-lg sm:max-w-md data-ending-style:-translate-x-full data-starting-style:-translate-x-full",
};

/**
 * kubkit Sheet — modal side or edge panel for longer navigation and compact workflows.
 * Use Dialog for centered decisions and Popover for short anchored content.
 */
function Sheet({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetBackdrop({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Backdrop>) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="sheet-backdrop"
      className={cn(
        "fixed inset-0 z-50 min-h-dvh bg-foreground/30 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0 dark:bg-background/70",
        className,
      )}
      {...props}
    />
  );
}

function SheetViewport({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Viewport>) {
  return (
    <DialogPrimitive.Viewport
      data-slot="sheet-viewport"
      className={cn("fixed inset-0 z-50 pointer-events-none", className)}
      {...props}
    />
  );
}

export interface SheetContentProps
  extends Omit<React.ComponentProps<typeof DialogPrimitive.Popup>, "className"> {
  className?: string;
  side?: SheetSide;
  showCloseButton?: boolean;
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetBackdrop />
      <SheetViewport>
        <DialogPrimitive.Popup
          data-slot="sheet-content"
          data-side={side}
          className={cn(
            "pointer-events-auto fixed z-50 flex flex-col overflow-hidden bg-popover text-popover-foreground shadow-xl outline-none transition data-ending-style:opacity-0 data-starting-style:opacity-0",
            sheetSideClasses[side],
            className,
          )}
          {...props}
        >
          {children}
          {showCloseButton ? (
            <DialogPrimitive.Close
              data-slot="sheet-close"
              aria-label="Zavřít panel"
              className="focus-ring absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              <X aria-hidden />
            </DialogPrimitive.Close>
          ) : null}
        </DialogPrimitive.Popup>
      </SheetViewport>
    </SheetPortal>
  );
}

function SheetHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex shrink-0 flex-col gap-1.5 px-5 pt-5 text-left", className)}
      {...props}
    />
  );
}

function SheetBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="sheet-body"
      className={cn("flex-1 overflow-y-auto px-5 py-4", className)}
      {...props}
    />
  );
}

function SheetFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "mt-auto flex shrink-0 flex-col-reverse gap-2 bg-muted/35 px-5 py-4 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("pr-10 text-lg font-semibold leading-6", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn("max-w-prose text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetBackdrop,
  SheetViewport,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
