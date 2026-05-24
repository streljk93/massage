"use client";

import { CalendarOff, Clock, PackageOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import type { BookableServiceOption } from "@/entities/services";
import {
  ProfileServicePickCard,
  ProfileServiceSphereChips,
} from "@/entities/services";
import { SalonSpecialistPickCard } from "@/entities/specialists";
import type { SalonSpecialistPick } from "@/entities/specialists";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/shadcn/empty";
import { cn, motion } from "@/shared/lib";
import { filterSlotTimesForDuration } from "@/views/specialist-profile/lib/filter-slots-for-duration";
import type { OrganizationProfileData } from "../model/organization-profile-data";

export type OrganizationProfileBookingPanelProps = {
  profile: Pick<
    OrganizationProfileData,
    "calendarDays" | "slotCalendarDates" | "timeSlotsByDay"
  >;
  showBookingFlow: boolean;
  organizationServiceSphereTabs: ReturnType<
    typeof import("@/entities/services").majorSphereTabsFromBookableRows
  >;
  orgSphereChipValue: string;
  onOrgSphereChange: (slug: string) => void;
  salonBookableServiceOptions: BookableServiceOption[];
  selectedServiceMenuKey: string;
  durationByMenuKey: Record<string, number>;
  onSelectSalonService: (svc: BookableServiceOption, menuKey: string) => void;
  onSelectSalonDuration: (svc: BookableServiceOption, menuKey: string, m: number) => void;
  serviceMenuKeyFromOption: (s: BookableServiceOption) => string;
  specialistsCount: number;
  salonMergedCount: number;
  dayIndex: number;
  onDayIndexChange: (index: number) => void;
  daySlots: string[];
  filteredDaySlots: string[];
  effectiveSlot: string;
  onSlotChange: (slot: string) => void;
  selectedBookingMinutes: number | undefined;
  bookingPending: boolean;
  formatPrice: (vnd: number) => string;
  specialistsWithSelectedMenuService: SalonSpecialistPick[];
  selectedSalonSpecialistId: string;
  proposedBookingSlotKeys: Set<string> | null;
  onSelectSpecialist: (id: string) => void;
  specialistAvailableCoversProposed: (
    available: readonly string[],
    proposed: Set<string>,
  ) => boolean;
  specialistOccupiedOverlapsProposed: (
    occupied: readonly string[],
    proposed: Set<string>,
  ) => boolean;
};

export function OrganizationProfileBookingPanel({
  profile,
  showBookingFlow,
  organizationServiceSphereTabs,
  orgSphereChipValue,
  onOrgSphereChange,
  salonBookableServiceOptions,
  selectedServiceMenuKey,
  durationByMenuKey,
  onSelectSalonService,
  onSelectSalonDuration,
  serviceMenuKeyFromOption,
  specialistsCount,
  salonMergedCount,
  dayIndex,
  onDayIndexChange,
  daySlots,
  filteredDaySlots,
  effectiveSlot,
  onSlotChange,
  selectedBookingMinutes,
  bookingPending,
  formatPrice,
  specialistsWithSelectedMenuService,
  selectedSalonSpecialistId,
  proposedBookingSlotKeys,
  onSelectSpecialist,
  specialistAvailableCoversProposed,
  specialistOccupiedOverlapsProposed,
}: OrganizationProfileBookingPanelProps) {
  const t = useTranslations("organizationProfile");

  return (
    <div className="space-y-5">
      {showBookingFlow ? (
        <section className="space-y-2.5">
          <h3 className="font-heading text-base font-semibold text-foreground">
            {t("selectService")}
          </h3>
          <ProfileServiceSphereChips
            items={organizationServiceSphereTabs}
            valueSlug={orgSphereChipValue}
            onChange={onOrgSphereChange}
            disabled={bookingPending}
          />
          {salonBookableServiceOptions.length === 0 ? (
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
          ) : (
            <div className="space-y-2.5">
              {salonBookableServiceOptions.map((svc) => {
                const menuKey = serviceMenuKeyFromOption(svc);
                const selected = menuKey === selectedServiceMenuKey;
                const dur = durationByMenuKey[menuKey] ?? svc.durationMinutes[0];
                return (
                  <ProfileServicePickCard
                    key={menuKey}
                    service={svc}
                    selected={selected}
                    selectedDurationMinutes={dur}
                    formatPrice={formatPrice}
                    formatDurationMinutes={(m) => t("durationMin", { n: m })}
                    onSelectService={() => onSelectSalonService(svc, menuKey)}
                    onSelectDuration={(m) =>
                      onSelectSalonDuration(svc, menuKey, m)
                    }
                  />
                );
              })}
            </div>
          )}
        </section>
      ) : specialistsCount > 0 && salonMergedCount === 0 ? (
        <Empty className="items-stretch py-4">
          <EmptyHeader className="max-w-none">
            <EmptyMedia variant="icon">
              <PackageOpen aria-hidden />
            </EmptyMedia>
            <EmptyTitle className="text-muted-foreground">
              {t("noServicesForSalon")}
            </EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : null}

      {showBookingFlow && salonBookableServiceOptions.length > 0 ? (
        <>
          <section className="space-y-2.5">
            <h3 className="font-heading text-base font-semibold text-foreground">
              {t("selectDate")}
            </h3>
            <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {profile.calendarDays.map((d, i) => {
                const selected = i === dayIndex;
                return (
                  <button
                    key={profile.slotCalendarDates[i] ?? i}
                    type="button"
                    onClick={() => {
                      onDayIndexChange(i);
                      const raw = profile.timeSlotsByDay[i] ?? [];
                      const nextSlots =
                        selectedBookingMinutes !== undefined
                          ? filterSlotTimesForDuration(
                              raw,
                              selectedBookingMinutes,
                            )
                          : raw;
                      onSlotChange(nextSlots[0] ?? "");
                    }}
                    className={cn(
                      motion.interactivePressStrong,
                      "flex w-[3.25rem] shrink-0 flex-col items-center gap-1 rounded-3xl border px-2 py-3 text-center",
                      selected
                        ? "border-primary/50 bg-primary/10"
                        : "border-transparent bg-muted/38",
                    )}
                  >
                    <span className="text-[0.7rem] font-medium uppercase text-muted-foreground">
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
            <h3 className="font-heading text-base font-semibold text-foreground">
              {t("selectSlot")}
            </h3>
            {filteredDaySlots.length === 0 ? (
              <Empty className="items-stretch py-3">
                <EmptyHeader className="max-w-none">
                  <EmptyMedia variant="icon">
                    <Clock aria-hidden />
                  </EmptyMedia>
                  <EmptyDescription className="text-sm">
                    {t(
                      daySlots.length === 0
                        ? "noSlots"
                        : "noSlotsForDuration",
                    )}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredDaySlots.map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => onSlotChange(time)}
                    className={cn(
                      motion.interactivePressStrong,
                      "flex h-10 min-w-[5rem] items-center justify-center rounded-full border px-3 text-sm font-semibold tabular-nums",
                      time === effectiveSlot
                        ? "border-primary/45 bg-primary/12 text-primary"
                        : "border-border/55 bg-muted/35",
                    )}
                  >
                    {time}
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}

      {specialistsWithSelectedMenuService.length > 0 ? (
        <section className="space-y-2.5">
          <h3 className="font-heading text-base font-semibold text-foreground">
            {t("selectSpecialist")}
          </h3>
          <div className="flex flex-col gap-3">
            {specialistsWithSelectedMenuService.map((pick, index) => {
              const scheduleUnavailable =
                proposedBookingSlotKeys !== null &&
                proposedBookingSlotKeys.size > 0 &&
                !specialistAvailableCoversProposed(
                  pick.availableListingSlotKeys,
                  proposedBookingSlotKeys,
                );
              const scheduleBusy =
                proposedBookingSlotKeys !== null &&
                proposedBookingSlotKeys.size > 0 &&
                specialistOccupiedOverlapsProposed(
                  pick.occupiedListingSlotKeys,
                  proposedBookingSlotKeys,
                );
              return (
                <SalonSpecialistPickCard
                  key={`${pick.specialistId}-${index}`}
                  pick={pick}
                  selected={pick.specialistId === selectedSalonSpecialistId}
                  scheduleDisabled={scheduleUnavailable || scheduleBusy}
                  scheduleDisabledLabel={t("specialistBusyThisSlot")}
                  selectLabel={t("specialistSelectCta")}
                  selectedLabel={t("specialistSelectedCta")}
                  profileHref={`/specialists/${pick.specialistId}`}
                  openProfileAriaLabel={t("specialistOpenProfileAria", {
                    name: pick.name,
                  })}
                  showBookableServices={false}
                  onSelect={() => onSelectSpecialist(pick.specialistId)}
                />
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
