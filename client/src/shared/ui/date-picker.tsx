"use client";

import { startTransition, useCallback, useLayoutEffect, useRef, useState } from "react";
import { format, type Locale } from "date-fns";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "../lib/utils";
import { Calendar } from "./shadcn/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./shadcn/popover";

export type DatePickerProps = {
  id?: string;
  value?: Date;
  onChange: (value: Date | undefined) => void;
  placeholder: string;
  className?: string;
  locale?: Locale;
  timeZone?: string;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  disabled?: (date: Date) => boolean;
  defaultMonth?: Date;
  /** Кастомная подпись вместо `format(..., "PPP")`. */
  formatValue?: (date: Date) => string;
  align?: "start" | "center" | "end";
};

/** shadcn-паттерн: триггер как `SelectTrigger` + Popover + Calendar. */
export function DatePicker({
  id,
  value,
  onChange,
  placeholder,
  className,
  locale,
  timeZone,
  weekStartsOn = 1,
  disabled,
  defaultMonth,
  formatValue,
  align = "start",
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(
    () => value ?? defaultMonth ?? new Date(),
  );
  /** Игнорировать повторное `open: true` сразу после выбора дня (Radix focus / pointer может открыть popover повторно). */
  const suppressOpenUntilMsRef = useRef(0);

  const handleOpenChange = useCallback((next: boolean) => {
    if (next && Date.now() < suppressOpenUntilMsRef.current) {
      return;
    }
    setOpen(next);
  }, []);

  /** Предыдущий `open` после коммита: только переход «закрыто → открыто». */
  const prevOpenRef = useRef(false);

  useLayoutEffect(() => {
    if (open && !prevOpenRef.current) {
      setCalendarMonth(value ?? defaultMonth ?? new Date());
    }
    prevOpenRef.current = open;
  }, [open, value, defaultMonth]);

  const label =
    value ?
      (formatValue?.(value) ?? format(value, "PPP", { locale }))
    : null;

  /** Радиус как у `SelectTrigger size="sm"` (`rounded-lg`); фильтры каталога дополняют через `className`. */
  const triggerClassName = cn(
    "group flex h-10 w-full min-w-0 select-none items-center justify-between gap-2 rounded-lg border border-border/45 bg-card px-2.5 py-2 text-left text-sm font-normal text-foreground shadow-none outline-none transition-colors motion-interactive hover:border-border hover:bg-muted/30 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-50 data-[empty=true]:text-muted-foreground dark:bg-input/25 dark:hover:bg-input/45",
    className,
  );

  return (
    <Popover modal={false} open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          data-empty={!value}
          aria-expanded={open}
          className={triggerClassName}
        >
          <span className="min-w-0 flex-1 truncate">
            {label ?? <span>{placeholder}</span>}
          </span>
          <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground transition-[color,transform] duration-200 ease-out group-hover:text-foreground/70 group-data-[state=open]:rotate-180 group-data-[state=open]:text-foreground/75" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "w-auto !gap-0 p-0 !duration-[1ms]",
          // Без входа/выхода zoom+fade при выборе дня — только instant hide Presence.
          "data-open:!animate-none data-closed:!animate-none",
          "pointer-events-auto",
        )}
        align={align}
        onCloseAutoFocus={(e) => {
          // Иначе фокус возвращается на триггер и иногда триггерит повторное «открытие» во время закрытия.
          e.preventDefault();
        }}
      >
        <Calendar
          mode="single"
          autoFocus={false}
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          selected={value}
          onSelect={(date) => {
            if (date == null) {
              return;
            }
            suppressOpenUntilMsRef.current = Date.now() + 280;
            setOpen(false);
            startTransition(() => {
              onChange(date);
            });
          }}
          locale={locale}
          timeZone={timeZone}
          weekStartsOn={weekStartsOn}
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
  );
}
