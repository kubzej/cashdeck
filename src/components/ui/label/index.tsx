import * as React from "react";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@/lib/utils";

/**
 * kubkit Label — a styled <label>. Pair with an input via `htmlFor`.
 * Polymorphic via `render`. Dims when its associated disabled control is a peer.
 */
export interface LabelProps extends React.ComponentProps<"label"> {
  render?: useRender.RenderProp;
}

function Label({ className, render, ...props }: LabelProps) {
  return useRender({
    defaultTagName: "label",
    render,
    props: {
      className: cn(
        "text-sm font-medium leading-none text-foreground select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      ),
      ...props,
    },
  });
}

export { Label };
