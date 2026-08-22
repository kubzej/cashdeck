import * as React from "react";
import { Toggle as BaseToggle } from "@base-ui/react/toggle";
import { ToggleGroup as BaseToggleGroup } from "@base-ui/react/toggle-group";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * kubkit Toggle — pressed/unpressed control for toolbars.
 * kubkit ToggleGroup — segmented single/multiple value control.
 */
const toggleVariants = cva(
  "focus-ring inline-flex min-h-11 min-w-11 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-full text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50 data-[pressed]:shadow-sm data-[pressed]:font-semibold [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground data-[pressed]:bg-card data-[pressed]:text-foreground",
        solid:
          "text-muted-foreground hover:bg-muted/60 hover:text-foreground data-[pressed]:bg-primary data-[pressed]:text-primary-foreground",
        ghost:
          "text-muted-foreground hover:bg-muted/60 hover:text-foreground data-[pressed]:bg-muted data-[pressed]:text-foreground",
      },
      size: {
        sm: "px-2 text-xs",
        default: "px-3 text-sm",
        lg: "min-h-12 px-4 text-sm",
        icon: "size-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ToggleVariantProps = VariantProps<typeof toggleVariants>;

export interface ToggleProps
  extends Omit<React.ComponentProps<typeof BaseToggle>, "className">,
    ToggleVariantProps {
  className?: string;
}

function Toggle({ className, variant, size, ...props }: ToggleProps) {
  return (
    <BaseToggle
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size }), className)}
      {...props}
    />
  );
}

type BaseToggleGroupProps = Omit<
  React.ComponentProps<typeof BaseToggleGroup>,
  "className" | "value" | "defaultValue" | "onValueChange" | "multiple"
>;

type ToggleGroupCommonProps = BaseToggleGroupProps &
  ToggleVariantProps & {
    className?: string;
    children?: React.ReactNode;
    width?: "fit" | "full";
  };

export type ToggleGroupSingleProps = ToggleGroupCommonProps & {
  type?: "single";
  value?: string;
  defaultValue?: string;
  onValueChange?: (
    value: string,
    details: BaseToggleGroup.ChangeEventDetails,
  ) => void;
};

export type ToggleGroupMultipleProps = ToggleGroupCommonProps & {
  type: "multiple";
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (
    value: string[],
    details: BaseToggleGroup.ChangeEventDetails,
  ) => void;
};

export type ToggleGroupProps =
  | ToggleGroupSingleProps
  | ToggleGroupMultipleProps;

interface ToggleGroupContextValue extends ToggleVariantProps {
  width: "fit" | "full";
}

const ToggleGroupContext = React.createContext<ToggleGroupContextValue>({
  variant: "default",
  size: "default",
  width: "fit",
});

function ToggleGroup({
  className,
  variant = "default",
  size = "default",
  width = "fit",
  type = "single",
  value,
  defaultValue,
  onValueChange,
  orientation = "horizontal",
  children,
  ...props
}: ToggleGroupProps) {
  const groupValue: readonly string[] | undefined =
    type === "multiple"
      ? (value as string[] | undefined)
      : typeof value === "string"
        ? [value]
        : undefined;
  const groupDefaultValue: readonly string[] | undefined =
    type === "multiple"
      ? (defaultValue as string[] | undefined)
      : typeof defaultValue === "string"
        ? [defaultValue]
        : undefined;

  return (
    <BaseToggleGroup
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      data-width={width}
      multiple={type === "multiple"}
      value={groupValue}
      defaultValue={groupDefaultValue}
      onValueChange={(nextValue, details) => {
        if (type === "multiple") {
          (onValueChange as ToggleGroupMultipleProps["onValueChange"])?.(
            [...nextValue],
            details,
          );
          return;
        }

        (onValueChange as ToggleGroupSingleProps["onValueChange"])?.(
          nextValue[0] ?? "",
          details,
        );
      }}
      orientation={orientation}
      className={cn(
        "group/toggle-group inline-flex items-center gap-1 rounded-full bg-muted/50 p-1 data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
        width === "full" && "w-full",
        className,
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size, width }}>
        {children}
      </ToggleGroupContext.Provider>
    </BaseToggleGroup>
  );
}

export interface ToggleGroupItemProps
  extends Omit<React.ComponentProps<typeof BaseToggle>, "className">,
    ToggleVariantProps {
  className?: string;
}

function ToggleGroupItem({
  className,
  variant,
  size,
  ...props
}: ToggleGroupItemProps) {
  const context = React.useContext(ToggleGroupContext);
  const itemVariant = variant ?? context.variant;
  const itemSize = size ?? context.size;

  return (
    <BaseToggle
      data-slot="toggle-group-item"
      className={cn(
        toggleVariants({ variant: itemVariant, size: itemSize }),
        "data-[orientation=vertical]:justify-start",
        context.width === "full" && "flex-1",
        className,
      )}
      {...props}
    />
  );
}

export { Toggle, ToggleGroup, ToggleGroupItem };
