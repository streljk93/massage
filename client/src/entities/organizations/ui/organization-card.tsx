import { BedDouble } from "lucide-react";
import {
  EntityCard,
  EntityCardContent,
  EntityCardImage,
} from "@/shared/ui/card";
import { Rating } from "@/shared/ui/rating";
import {
  AvailabilitySlotStrip,
  type AvailabilitySlotGroup,
} from "@/shared/ui";
import { cn } from "@/shared/lib";

export type OrganizationCardProps = {
  name: string;
  imageSrc: string;
  imageAlt: string;
  rating: number;
  metaLine: string;
  servicesLine: string;
  slotGroups: AvailabilitySlotGroup[];
  onSelectSlotTime?: (payload: { dayLabel: string; time: string }) => void;
  onOpenCalendar?: () => void;
  className?: string;
};

export function OrganizationCard({
  name,
  imageSrc,
  imageAlt,
  rating,
  metaLine,
  servicesLine,
  slotGroups,
  onSelectSlotTime,
  onOpenCalendar,
  className,
}: OrganizationCardProps) {
  return (
    <EntityCard className={cn("items-start", className)}>
      <EntityCardImage src={imageSrc} alt={imageAlt} />
      <EntityCardContent>
        <div className="flex items-start justify-between gap-2">
          <Rating value={rating} />
          <BedDouble
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </div>
        <h3 className="font-heading text-base font-semibold tracking-tight text-foreground">
          {name}
        </h3>
        <p className="line-clamp-2 text-xs text-muted-foreground">{metaLine}</p>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {servicesLine}
        </p>
        <AvailabilitySlotStrip
          groups={slotGroups}
          onSelectTime={onSelectSlotTime}
          onOpenCalendar={onOpenCalendar}
        />
      </EntityCardContent>
    </EntityCard>
  );
}
