import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type PageWidth = "narrow" | "default" | "wide" | "full";
type PageGap = "sm" | "md" | "lg";

const widthClasses: Record<PageWidth, string> = {
  narrow: "mx-auto w-full max-w-3xl",
  default: "mx-auto w-full max-w-4xl",
  wide: "mx-auto w-full max-w-6xl",
  full: "w-full",
};

const gapClasses: Record<PageGap, string> = {
  sm: "space-y-4",
  md: "space-y-6",
  lg: "space-y-8",
};

export interface PageShellProps {
  children: ReactNode;
  width?: PageWidth;
  gap?: PageGap;
  bleed?: boolean;
  className?: string;
}

function PageShell({
  children,
  width = "wide",
  gap = "md",
  bleed = false,
  className,
}: PageShellProps) {
  return (
    <div
      data-slot="page-shell"
      data-width={width}
      data-gap={gap}
      data-bleed={bleed ? "true" : undefined}
      className={cn(
        "pb-12",
        widthClasses[width],
        gapClasses[gap],
        bleed && "-mx-4 sm:-mx-6 lg:-mx-8",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface PageTopRailProps {
  children: ReactNode;
  className?: string;
}

function PageTopRail({ children, className }: PageTopRailProps) {
  return (
    <div
      data-slot="page-top-rail"
      className={cn(
        "sticky top-14 z-10 max-w-full space-y-3 overflow-x-auto bg-background/95 py-2 backdrop-blur lg:top-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface PageIntroProps {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
}

function PageIntro({
  title,
  subtitle,
  eyebrow,
  meta,
  leading,
  actions,
  className,
  titleClassName,
}: PageIntroProps) {
  return (
    <header data-slot="page-intro" className={cn("space-y-3", className)}>
      {leading}
      <div className="space-y-2">
        {eyebrow && (
          <div
            data-slot="page-intro-eyebrow"
            className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
          >
            {eyebrow}
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <h1
              data-slot="page-intro-title"
              className={cn("text-2xl font-bold tracking-tight", titleClassName)}
            >
              {title}
            </h1>
            {subtitle && (
              <div
                data-slot="page-intro-subtitle"
                className="max-w-3xl text-sm leading-relaxed text-muted-foreground"
              >
                {subtitle}
              </div>
            )}
          </div>
          {actions && (
            <div
              data-slot="page-intro-actions"
              className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end"
            >
              {actions}
            </div>
          )}
        </div>
      </div>
      {meta && (
        <div
          data-slot="page-intro-meta"
          className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
        >
          {meta}
        </div>
      )}
    </header>
  );
}

export interface PageSectionProps {
  children: ReactNode;
  gap?: PageGap;
  className?: string;
}

function PageSection({
  children,
  gap = "md",
  className,
}: PageSectionProps) {
  return (
    <section
      data-slot="page-section"
      data-gap={gap}
      className={cn(gapClasses[gap], className)}
    >
      {children}
    </section>
  );
}

export interface PageBackButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label?: ReactNode;
}

function PageBackButton({
  label = "Back",
  className,
  ...props
}: PageBackButtonProps) {
  return (
    <button
      data-slot="page-back-button"
      type="button"
      className={cn(
        "focus-ring -ml-2 inline-flex h-11 w-fit items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      <ArrowLeft aria-hidden />
      {label}
    </button>
  );
}

export {
  PageShell,
  PageTopRail,
  PageIntro,
  PageSection,
  PageBackButton,
};
