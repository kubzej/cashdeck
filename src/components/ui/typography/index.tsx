import * as React from "react";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * kubkit typography — Heading, Text, Eyebrow.
 *
 * The closed set of text styles the kit uses. Polymorphic via the `render` prop
 * (Base UI idiom): `<Text render={<p />}>` to change the element. Token-only.
 */

// ---------------------------------------------------------------- Heading

const headingVariants = cva(
  "text-balance tracking-tight text-foreground",
  {
    variants: {
      level: {
        1: "text-3xl font-bold",
        2: "text-xl font-semibold",
        3: "text-lg font-semibold",
        4: "text-sm font-semibold",
      },
    },
    defaultVariants: { level: 2 },
  },
);

export interface HeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof headingVariants> {
  render?: useRender.RenderProp;
}

function Heading({ level, className, render, ...props }: HeadingProps) {
  return useRender({
    defaultTagName: `h${level ?? 2}` as "h1",
    render,
    props: { className: cn(headingVariants({ level }), className), ...props },
  });
}

// ------------------------------------------------------------------- Text

const textVariants = cva("", {
  variants: {
    size: {
      xs: "text-xs",
      sm: "text-sm",
      base: "text-base",
      lg: "text-lg",
    },
    tone: {
      default: "text-foreground",
      muted: "text-muted-foreground",
    },
    weight: {
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
    },
    numeric: {
      true: "font-mono-num",
    },
  },
  defaultVariants: { size: "sm", tone: "default", weight: "normal" },
});

export interface TextProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof textVariants> {
  render?: useRender.RenderProp;
}

function Text({ size, tone, weight, numeric, className, render, ...props }: TextProps) {
  return useRender({
    defaultTagName: "span",
    render,
    props: {
      className: cn(textVariants({ size, tone, weight, numeric }), className),
      ...props,
    },
  });
}

// ---------------------------------------------------------------- Eyebrow

export interface EyebrowProps extends React.HTMLAttributes<HTMLElement> {
  render?: useRender.RenderProp;
}

function Eyebrow({ className, render, ...props }: EyebrowProps) {
  return useRender({
    defaultTagName: "p",
    render,
    props: {
      className: cn(
        "text-xs font-semibold tracking-wide text-muted-foreground uppercase",
        className,
      ),
      ...props,
    },
  });
}

export { Heading, Text, Eyebrow, headingVariants, textVariants };
