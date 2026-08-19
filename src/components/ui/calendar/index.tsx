import * as React from "react";
import { Button as BaseButton } from "@base-ui/react/button";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type DisabledMatcher = Date[] | ((date: Date) => boolean);

function normalizeDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function isSameDay(a?: Date, b?: Date) {
  return !!a && !!b && normalizeDate(a).getTime() === normalizeDate(b).getTime();
}

function isBeforeDay(a: Date, b: Date) {
  return normalizeDate(a).getTime() < normalizeDate(b).getTime();
}

function isAfterDay(a: Date, b: Date) {
  return normalizeDate(a).getTime() > normalizeDate(b).getTime();
}

function toIsoDate(date?: Date) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date?: Date, locale = "en-US") {
  if (!date) return "";
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatMonth(date: Date, locale = "en-US") {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(date);
}

function getWeekdayLabels(locale: string, startOfWeek: number) {
  return Array.from({ length: 7 }, (_, index) => {
    const dayIndex = (startOfWeek + index) % 7;
    const date = new Date(2026, 0, 4 + dayIndex);
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
  });
}

function getCalendarDays(month: Date, startOfWeek: number) {
  const firstDay = startOfMonth(month);
  const offset = (firstDay.getDay() - startOfWeek + 7) % 7;
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - offset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function isDisabled(
  date: Date,
  minDate?: Date,
  maxDate?: Date,
  disabledDates?: DisabledMatcher,
) {
  if (minDate && isBeforeDay(date, minDate)) return true;
  if (maxDate && isAfterDay(date, maxDate)) return true;
  if (Array.isArray(disabledDates)) {
    return disabledDates.some((disabledDate) => isSameDay(disabledDate, date));
  }
  return disabledDates?.(date) ?? false;
}

export interface CalendarProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  value?: Date;
  defaultValue?: Date;
  onValueChange?: (date: Date) => void;
  month?: Date;
  defaultMonth?: Date;
  onMonthChange?: (month: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: DisabledMatcher;
  locale?: string;
  startOfWeek?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  showOutsideDays?: boolean;
}

function Calendar({
  className,
  value,
  defaultValue,
  onValueChange,
  month,
  defaultMonth,
  onMonthChange,
  minDate,
  maxDate,
  disabledDates,
  locale = "en-US",
  startOfWeek = 0,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const selectedDate = value ?? uncontrolledValue;
  const [uncontrolledMonth, setUncontrolledMonth] = React.useState(
    startOfMonth(defaultMonth ?? selectedDate ?? new Date()),
  );
  const visibleMonth = startOfMonth(month ?? uncontrolledMonth);
  const days = getCalendarDays(visibleMonth, startOfWeek);
  const weekdayLabels = getWeekdayLabels(locale, startOfWeek);
  const today = normalizeDate(new Date());

  const updateMonth = (nextMonth: Date) => {
    const normalized = startOfMonth(nextMonth);
    if (!month) setUncontrolledMonth(normalized);
    onMonthChange?.(normalized);
  };

  const selectDate = (date: Date) => {
    const nextDate = normalizeDate(date);
    if (!value) setUncontrolledValue(nextDate);
    onValueChange?.(nextDate);
  };

  return (
    <div
      data-slot="calendar"
      className={cn(
        "w-fit max-w-full rounded-lg bg-card p-3 text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    >
      <div
        data-slot="calendar-header"
        className="mb-3 flex items-center justify-between gap-2"
      >
        <BaseButton
          data-slot="calendar-prev"
          type="button"
          aria-label="Previous month"
          className="focus-ring inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          onClick={() => updateMonth(addMonths(visibleMonth, -1))}
        >
          <ChevronLeft aria-hidden className="size-4" />
        </BaseButton>
        <div
          data-slot="calendar-month"
          className="text-sm font-semibold text-foreground"
          aria-live="polite"
        >
          {formatMonth(visibleMonth, locale)}
        </div>
        <BaseButton
          data-slot="calendar-next"
          type="button"
          aria-label="Next month"
          className="focus-ring inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          onClick={() => updateMonth(addMonths(visibleMonth, 1))}
        >
          <ChevronRight aria-hidden className="size-4" />
        </BaseButton>
      </div>
      <div
        data-slot="calendar-weekdays"
        className="grid grid-cols-[repeat(7,2.75rem)] gap-1.5 text-center text-xs font-medium text-muted-foreground"
      >
        {weekdayLabels.map((label) => (
          <div key={label} className="py-1">
            {label}
          </div>
        ))}
      </div>
      <div
        data-slot="calendar-grid"
        className="mt-1 grid grid-cols-[repeat(7,2.75rem)] gap-1.5"
      >
        {days.map((date) => {
          const outside = date.getMonth() !== visibleMonth.getMonth();
          const disabled =
            isDisabled(date, minDate, maxDate, disabledDates) ||
            (!showOutsideDays && outside);
          const selected = isSameDay(date, selectedDate);
          const current = isSameDay(date, today);

          return (
            <BaseButton
              key={toIsoDate(date)}
              data-slot="calendar-day"
              data-selected={selected ? "true" : "false"}
              data-today={current ? "true" : "false"}
              data-outside={outside ? "true" : "false"}
              type="button"
              disabled={disabled}
              aria-label={formatDate(date, locale)}
              aria-pressed={selected}
              className={cn(
                "focus-ring inline-flex size-11 items-center justify-center rounded-md text-sm font-medium transition-colors",
                "hover:bg-muted data-[outside=true]:text-muted-foreground/55",
                "data-[today=true]:bg-muted/60 data-[today=true]:text-foreground",
                "data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground data-[selected=true]:shadow-sm",
                "disabled:pointer-events-none disabled:text-muted-foreground/35 disabled:opacity-70",
              )}
              onClick={() => selectDate(date)}
            >
              {date.getDate()}
            </BaseButton>
          );
        })}
      </div>
    </div>
  );
}

export interface DatePickerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  value?: Date;
  defaultValue?: Date;
  onValueChange?: (date: Date) => void;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  locale?: string;
  startOfWeek?: CalendarProps["startOfWeek"];
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: DisabledMatcher;
  formatDate?: (date: Date) => string;
  triggerClassName?: string;
  calendarClassName?: string;
  side?: React.ComponentProps<typeof PopoverPrimitive.Positioner>["side"];
  align?: React.ComponentProps<typeof PopoverPrimitive.Positioner>["align"];
}

function DatePicker({
  className,
  value,
  defaultValue,
  onValueChange,
  name,
  placeholder = "Pick a date",
  disabled = false,
  locale = "en-US",
  startOfWeek,
  minDate,
  maxDate,
  disabledDates,
  formatDate: formatDateProp,
  triggerClassName,
  calendarClassName,
  side = "bottom",
  align = "start",
  ...props
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const selectedDate = value ?? uncontrolledValue;

  const selectDate = (date: Date) => {
    const nextDate = normalizeDate(date);
    if (!value) setUncontrolledValue(nextDate);
    onValueChange?.(nextDate);
    setOpen(false);
  };

  const label = selectedDate
    ? (formatDateProp?.(selectedDate) ?? formatDate(selectedDate, locale))
    : placeholder;

  return (
    <div data-slot="date-picker" className={cn("w-full max-w-sm", className)} {...props}>
      {name ? <input type="hidden" name={name} value={toIsoDate(selectedDate)} /> : null}
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Trigger
          data-slot="date-picker-trigger"
          type="button"
          disabled={disabled}
          className={cn(
            "focus-ring flex h-11 w-full items-center justify-between gap-3 rounded-md border border-input bg-transparent px-3 text-left text-sm transition-colors hover:bg-muted/45 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
            !selectedDate && "text-muted-foreground",
            triggerClassName,
          )}
        >
          <span className="truncate">{label}</span>
          <CalendarDays aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Positioner
            side={side}
            align={align}
            sideOffset={8}
            collisionPadding={12}
            className="z-50"
          >
            <PopoverPrimitive.Popup
              data-slot="date-picker-content"
              className="rounded-lg bg-popover text-popover-foreground shadow-lg outline-none transition data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 data-instant:transition-none"
            >
              <Calendar
                value={selectedDate}
                defaultMonth={selectedDate}
                onValueChange={selectDate}
                locale={locale}
                startOfWeek={startOfWeek}
                minDate={minDate}
                maxDate={maxDate}
                disabledDates={disabledDates}
                className={calendarClassName}
              />
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  );
}

export { Calendar, DatePicker };
