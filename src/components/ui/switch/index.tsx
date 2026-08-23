import * as React from "react";
import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { cn } from "@/lib/utils";

/**
 * kubkit Switch — instant on/off toggle, built on Base UI. Token-only.
 */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof BaseSwitch.Root>) {
  return (
    <BaseSwitch.Root
      data-slot="switch"
      className={cn(
        "focus-ring inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-muted transition-colors data-[checked]:bg-primary disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <BaseSwitch.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-5 translate-x-0.5 rounded-full bg-card shadow-sm transition-transform data-[checked]:translate-x-[1.375rem]"
      />
    </BaseSwitch.Root>
  );
}

export { Switch };
