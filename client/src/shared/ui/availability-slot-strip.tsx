"use client";

import { Fragment } from "react";
import { Calendar } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn, motion } from "../lib";
import { Tag, tagVariants } from "./tag";

export type AvailabilitySlotGroup = {
  dayLabel: string;
  times: string[];
};

export type AvailabilitySlotStripProps = {
  groups: AvailabilitySlotGroup[];
  onSelectTime?: (payload: { dayLabel: string; time: string }) => void;
  onOpenCalendar?: () => void;
  className?: string;
};

export function AvailabilitySlotStrip({
  groups,
  onSelectTime,
  onOpenCalendar,
  className,
}: AvailabilitySlotStripProps) {
  const t = useTranslations("availabilitySlots");

  if (groups.length === 0) return null;

  return (
    <div
      role="group"
      aria-label={t("regionAria")}
      className={cn(
        "-mx-0.5 mt-1 flex min-w-0 w-full max-w-full touch-pan-x gap-1.5 overflow-x-auto overscroll-x-contain px-0.5 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "transform-gpu [-webkit-overflow-scrolling:touch]",
        className,
      )}
    >
      {groups.map((group, groupIndex) => (
        <Fragment key={groupIndex}>
          <Tag
            variant="default"
            bordered
            className="shrink-0 touch-pan-x text-[0.65rem] capitalize"
            aria-hidden
          >
            {group.dayLabel}
          </Tag>
          {group.times.map((time) => (
            <button
              key={`${groupIndex}-${time}`}
              type="button"
              className={cn(
                tagVariants({ variant: "slot" }),
                motion.interactivePressStrong,
                "shrink-0 cursor-pointer touch-pan-x text-[0.65rem]",
              )}
              onClick={() => onSelectTime?.({ dayLabel: group.dayLabel, time })}
              aria-label={`${time}, ${group.dayLabel}`}
            >
              {time}
            </button>
          ))}
        </Fragment>
      ))}
      <button
        type="button"
        className={cn(
          tagVariants({ variant: "default", bordered: true }),
          motion.interactivePressStrong,
          "shrink-0 cursor-pointer touch-pan-x gap-1.5 text-[0.65rem] font-medium leading-none text-foreground",
          "hover:bg-muted/35 active:bg-muted/50",
        )}
        aria-label={t("calendarAria")}
        onClick={() => onOpenCalendar?.()}
      >
        <Calendar className="size-3 shrink-0 opacity-90" aria-hidden />
        <span>{t("calendarLabel")}</span>
      </button>
    </div>
  );
}
