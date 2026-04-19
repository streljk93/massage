import { BedDouble } from "lucide-react";
import {
  EntityCard,
  EntityCardContent,
  EntityCardImage,
} from "@/shared/ui/card";
import { Rating } from "@/shared/ui/rating";
import { Tag } from "@/shared/ui/tag";
import { cn } from "@/shared/lib";

export type OrganizationCardProps = {
  name: string;
  imageSrc: string;
  imageAlt: string;
  rating: number;
  metaLine: string;
  servicesLine: string;
  slotLabels: string[];
  className?: string;
};

export function OrganizationCard({
  name,
  imageSrc,
  imageAlt,
  rating,
  metaLine,
  servicesLine,
  slotLabels,
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
        <div className="mt-1 flex flex-wrap gap-1.5">
          {slotLabels.map((label) => (
            <Tag
              key={label}
              variant={label.toLowerCase() === "today" ? "default" : "slot"}
              className="text-[0.65rem] capitalize"
            >
              {label}
            </Tag>
          ))}
        </div>
      </EntityCardContent>
    </EntityCard>
  );
}
