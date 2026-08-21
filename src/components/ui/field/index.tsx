import * as React from "react";
import { Field as FieldPrimitive } from "@base-ui/react/field";
import { cn } from "@/lib/utils";

/**
 * kubkit Field — a labelled form field on Base UI Field. Wires the label to the
 * control, links the description and error via aria-describedby, and propagates
 * the invalid state — no manual id/htmlFor/aria plumbing.
 *
 * kubkit Input/Textarea/Select/Checkbox/Switch auto-wire inside a Field; for any
 * other control, wrap it in FieldControl.
 */
function Field({
  className,
  ...props
}: React.ComponentProps<typeof FieldPrimitive.Root>) {
  return (
    <FieldPrimitive.Root
      data-slot="field"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  );
}

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<typeof FieldPrimitive.Label>) {
  return (
    <FieldPrimitive.Label
      data-slot="field-label"
      className={cn(
        "text-sm font-medium text-foreground select-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function FieldControl({
  className,
  ...props
}: React.ComponentProps<typeof FieldPrimitive.Control>) {
  return (
    <FieldPrimitive.Control
      data-slot="field-control"
      className={className}
      {...props}
    />
  );
}

function FieldDescription({
  className,
  ...props
}: React.ComponentProps<typeof FieldPrimitive.Description>) {
  return (
    <FieldPrimitive.Description
      data-slot="field-description"
      className={cn("text-xs leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  );
}

function FieldError({
  className,
  ...props
}: React.ComponentProps<typeof FieldPrimitive.Error>) {
  return (
    <FieldPrimitive.Error
      data-slot="field-error"
      className={cn("text-xs font-medium text-destructive", className)}
      {...props}
    />
  );
}

export { Field, FieldLabel, FieldControl, FieldDescription, FieldError };
