import * as React from "react";
import { Input as BaseInput } from "@base-ui/react/input";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type BaseInputProps = React.ComponentProps<typeof BaseInput>;

/**
 * kubkit Input — styled text input on Base UI (works standalone or inside a Field).
 * Token-only, ≥44px tall (touch). Invalid state via `aria-invalid` (red ring).
 */
export interface InputProps
  extends Omit<BaseInputProps, "className" | "ref"> {
  className?: string;
  clearable?: boolean;
  clearLabel?: string;
  onClear?: () => void;
}

function Input({
  className,
  clearable = false,
  clearLabel = "Clear input",
  defaultValue,
  disabled,
  onChange,
  onClear,
  readOnly,
  type,
  value,
  ...props
}: InputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uncontrolledValue, setUncontrolledValue] = React.useState(
    defaultValue == null ? "" : String(defaultValue),
  );
  const currentValue = value == null ? uncontrolledValue : String(value);
  const canClear = clearable && currentValue.length > 0 && !disabled && !readOnly;

  function handleChange(
    event: Parameters<NonNullable<BaseInputProps["onChange"]>>[0],
  ) {
    if (value == null) {
      setUncontrolledValue(event.currentTarget.value);
    }

    onChange?.(event);
  }

  function handleClear() {
    if (value == null && inputRef.current) {
      inputRef.current.value = "";
      setUncontrolledValue("");
      inputRef.current.dispatchEvent(new Event("input", { bubbles: true }));
    }

    onClear?.();
    inputRef.current?.focus();
  }

  const input = (
    <BaseInput
      ref={inputRef}
      type={type}
      value={value}
      defaultValue={defaultValue}
      disabled={disabled}
      readOnly={readOnly}
      onChange={handleChange}
      className={cn(
        "focus-ring invalid-ring flex h-11 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors dark:bg-input/30",
        "placeholder:text-muted-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50",
        clearable &&
          "pr-10 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none",
        className,
      )}
      {...props}
    />
  );

  if (!clearable) {
    return input;
  }

  return (
    <div className="relative w-full">
      {input}
      {canClear ? (
        <button
          type="button"
          aria-label={clearLabel}
          className="focus-ring absolute right-1 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
          onClick={handleClear}
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

export { Input };
