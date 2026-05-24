"use client";

import { CalendarOff, Clock, PackageOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import type { BookableServiceOption } from "@/entities/services";
import {
  ProfileServicePickCard,
  ProfileServiceSphereChips,
} from "@/entities/services";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/shadcn/empty";
import { cn, motion } from "@/shared/lib";
import { filterSlotTimesForDuration } from "../lib/filter-slots-for-duration";
import type { SpecialistCalendarDay, SpecialistProfileData } from "../model/specialist-profile-data";

export type SpecialistProfileBookingPanelProps = {
  profile: Pick<
    SpecialistProfileData,
    "calendarDays" | "slotCalendarDates" | "timeSlotsByDay" | "services"
  >;
  serviceSphereTabs: ReturnType<
    typeof import("@/entities/services").majorSphereTabsFromBookableRows
  >;
  sphereChipValue: string;
  onSphereChange: (slug: string) => void;
  visibleBookingServices: BookableServiceOption[];
  bookableRowId: string;
  onSelectService: (id: string) => void;
  durationByBookableRow: Record<string, number>;
  onSelectDuration: (serviceId: string, minutes: number) => void;
  dayIndex: number;
  onDayIndexChange: (index: number) => void;
  effectiveSlot: string;
  onSlotChange: (slot: string) => void;
  filteredDaySlots: string[];
  selectedBookingMinutes: number | undefined;
  bookingPending: boolean;
  formatPrice: (vnd: number) => string;
};

export function SpecialistProfileBookingPanel({
  profile,
  serviceSphereTabs,
  sphereChipValue,
  onSphereChange,
  visibleBookingServices,
  bookableRowId,
  onSelectService,
  durationByBookableRow,
  onSelectDuration,
  dayIndex,
  onDayIndexChange,
  effectiveSlot,
  onSlotChange,
  filteredDaySlots,
  selectedBookingMinutes,
  bookingPending,
  formatPrice,
}: SpecialistProfileBookingPanelProps) {
  const t = useTranslations("specialistProfile");

  return (
    <div className="space-y-5">
      <section className="space-y-2.5">
        <h3 className="font-heading text-base font-semibold tracking-tight text-foreground">
          {t("selectService")}
        </h3>
        <ProfileServiceSphereChips
          items={serviceSphereTabs}
          valueSlug={sphereChipValue}
          onChange={onSphereChange}
          disabled={bookingPending}
        />
        <div className="space-y-2.5">
          {profile.services.length === 0 ? (
            <Empty className="items-stretch py-4">
              <EmptyHeader className="max-w-none">
                <EmptyMedia variant="icon">
                  <PackageOpen aria-hidden />
                </EmptyMedia>
                <EmptyTitle className="text-muted-foreground">
                  {t("noServices")}
                </EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : visibleBookingServices.length === 0 ? (
            <Empty className="items-stretch py-4">
              <EmptyHeader className="max-w-none">
                <EmptyMedia variant="icon">
                  <PackageOpen aria-hidden />
                </EmptyMedia>
                <EmptyTitle className="text-muted-foreground">
                  {t("noServicesInSphere")}
                </EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : null}
          {visibleBookingServices.map((svc) => {
            const selected = svc.id === bookableRowId;
            const dur = durationByBookableRow[svc.id] ?? svc.durationMinutes[0];
            return (
              <ProfileServicePickCard
                key={svc.id}
                service={svc}
                selected={selected}
                selectedDurationMinutes={dur}
                formatPrice={formatPrice}
                formatDurationMinutes={(m) => t("durationMin", { n: m })}
                onSelectService={() => onSelectService(svc.id)}
                onSelectDuration={(m) => onSelectDuration(svc.id, m)}
              />
            );
          })}
        </div>
      </section>

      <section className="space-y-2.5">
        <h3 className="font-heading text-base font-semibold tracking-tight text-foreground">
          {t("selectDate")}
        </h3>
        <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {profile.calendarDays.length === 0 ? (
            <Empty className="items-stretch px-1 py-3">
              <EmptyHeader className="max-w-none">
                <EmptyMedia variant="icon">
                  <CalendarOff aria-hidden />
                </EmptyMedia>
                <EmptyDescription className="text-sm">
                  {t("noSlots")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
          {profile.calendarDays.map((d: SpecialistCalendarDay, i) => {
            const selected = i === dayIndex;
            return (
              <button
                key={profile.slotCalendarDates[i] ?? i}
                type="button"
                onClick={() => {
                  onDayIndexChange(i);
                  const raw = profile.timeSlotsByDay[i] ?? [];
                  const next =
                    selectedBookingMinutes !== undefined
                      ? filterSlotTimesForDuration(
                          raw,
                          selectedBookingMinutes,
                        )
                      : raw;
                  onSlotChange(next[0] ?? "");
                }}
                className={cn(
                  motion.interactivePressStrong,
                  "flex w-[3.25rem] shrink-0 flex-col items-center gap-1 rounded-3xl border px-2 py-3 text-center transition-colors",
                  selected
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-transparent bg-muted/38 text-foreground hover:bg-muted/55",
                )}
              >
                <span
                  className={cn(
                    "text-[0.7rem] font-medium uppercase",
                    selected
                      ? "text-primary"
                      : "text-muted-foreground/75",
                  )}
                >
                  {t(`weekdays.${d.weekdayKey}`)}
                </span>
                <span className="text-base font-semibold tabular-nums">
                  {d.dayOfMonth}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-2.5">
        <h3 className="font-heading text-base font-semibold tracking-tight text-foreground">
          {t("selectSlot")}
        </h3>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-2">
          {filteredDaySlots.length === 0 ? (
            <Empty className="col-span-full items-stretch py-3">
              <EmptyHeader className="max-w-none">
                <EmptyMedia variant="icon">
                  <Clock aria-hidden />
                </EmptyMedia>
                <EmptyDescription className="text-sm">
                  {t(
                    profile.timeSlotsByDay[dayIndex]?.length === 0
                      ? "noSlots"
                      : "noSlotsForDuration",
                  )}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            filteredDaySlots.map((time) => {
              const selected = time === effectiveSlot;
              return (
                <button
                  key={time}
                  type="button"
                  onClick={() => onSlotChange(time)}
                  className={cn(
                    motion.interactivePressStrong,
                    "flex h-10 w-full min-w-0 touch-target items-center justify-center rounded-full border px-2 text-center text-sm font-semibold tabular-nums tracking-tight transition-colors",
                    selected
                      ? "border-primary/45 bg-primary/12 text-primary"
                      : "border-border/55 bg-muted/35 text-foreground hover:bg-muted/55",
                  )}
                >
                  {time}
                </button>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
