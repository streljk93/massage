"use client";

import { BedDouble } from "lucide-react";
import { Link, useRouter } from "@/app/i18n/navigation";
import {
  EntityCard,
  EntityCardContent,
  EntityCardImage,
} from "@/shared/ui/card";
import { Rating } from "@/shared/ui/rating";
import {
  AvailabilitySlotStrip,
  type AvailabilitySlotGroup,
  type AvailabilitySlotSelectPayload,
} from "@/shared/ui";
import {
  BOOKING_URL_SLOT_DAY,
  BOOKING_URL_SLOT_TIME,
} from "@/shared/lib/booking-slot-search-params";
import { cn, motion } from "@/shared/lib";

export type OrganizationCardProps = {
  name: string;
  imageSrc: string;
  imageAlt: string;
  rating: number;
  metaLine: string;
  servicesLine: string;
  slotGroups: AvailabilitySlotGroup[];
  /** Ссылка на карточку организации (салона). */
  profileHref?: string;
  onSelectSlotTime?: (payload: AvailabilitySlotSelectPayload) => void;
  onOpenCalendar?: () => void;
  className?: string;
};

function CardTextBlock({
  name,
  metaLine,
  servicesLine,
  rating,
}: Pick<
  OrganizationCardProps,
  "name" | "metaLine" | "servicesLine" | "rating"
>) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex w-full items-center gap-2">
        <h3 className="min-w-0 flex-1 font-heading text-base font-semibold tracking-tight text-foreground">
          {name}
        </h3>
        <BedDouble
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </div>
      <Rating value={rating} />
      <p className="line-clamp-2 text-xs text-muted-foreground">{metaLine}</p>
      <p className="line-clamp-2 text-xs text-muted-foreground">
        {servicesLine}
      </p>
    </div>
  );
}

export function OrganizationCard({
  name,
  imageSrc,
  imageAlt,
  rating,
  metaLine,
  servicesLine,
  slotGroups,
  profileHref,
  onSelectSlotTime,
  onOpenCalendar,
  className,
}: OrganizationCardProps) {
  const router = useRouter();
  const navigateSlotSelection =
    onSelectSlotTime ??
    ((p: AvailabilitySlotSelectPayload) => {
      if (!profileHref) {
        return;
      }
      const q = new URLSearchParams();
      q.set(BOOKING_URL_SLOT_DAY, p.calendarDate);
      q.set(BOOKING_URL_SLOT_TIME, p.time);
      router.push(`${profileHref}?${q.toString()}`);
    });

  const textBlock = (
    <CardTextBlock
      name={name}
      metaLine={metaLine}
      servicesLine={servicesLine}
      rating={rating}
    />
  );

  const strip = (
    <AvailabilitySlotStrip
      groups={slotGroups}
      onSelectTime={navigateSlotSelection}
      onOpenCalendar={onOpenCalendar}
    />
  );

  if (!profileHref) {
    return (
      <EntityCard className={cn("items-start", className)}>
        <EntityCardImage src={imageSrc} alt={imageAlt} />
        <EntityCardContent>
          {textBlock}
          {strip}
        </EntityCardContent>
      </EntityCard>
    );
  }

  return (
    <div className="relative min-w-0 w-full">
      <Link
        href={profileHref}
        className={cn(
          "peer absolute inset-0 z-[1] rounded-2xl bg-transparent outline-none",
          "touch-manipulation",
          "focus-visible:z-[5] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
        aria-label={name}
      />
      <article
        className={cn(
          motion.interactiveSlow,
          "relative z-[2] flex min-w-0 gap-3 overflow-visible rounded-2xl bg-card p-3 items-start",
          "origin-center pointer-events-none",
          "peer-active:scale-[0.97] peer-active:translate-y-px",
          className,
        )}
      >
        <EntityCardImage src={imageSrc} alt={imageAlt} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {textBlock}
          <div className="pointer-events-auto relative z-[3]">{strip}</div>
        </div>
      </article>
    </div>
  );
}
