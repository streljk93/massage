import { Calendar, Clock } from "lucide-react";
import { UserAvatar } from "@/shared/ui/avatar";
import { Tag } from "@/shared/ui/tag";
import { cn } from "@/shared/lib";

export type BookingCardProps = {
  specialistName: string;
  serviceLine: string;
  dateLabel: string;
  timeRange: string;
  avatarSrc?: string | null;
  className?: string;
};

export function BookingCard({
  specialistName,
  serviceLine,
  dateLabel,
  timeRange,
  avatarSrc,
  className,
}: BookingCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-neutral-800 px-4 py-3 text-white",
        className,
      )}
    >
      <div className="flex gap-3">
        <UserAvatar
          src={avatarSrc}
          alt={specialistName}
          fallback={specialistName.slice(0, 2).toUpperCase()}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="font-heading text-sm font-semibold tracking-tight">
            {specialistName}
          </p>
          <p className="mt-0.5 text-xs text-white/65">{serviceLine}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Tag variant="inverse" className="text-[0.7rem]">
          <Calendar className="size-3.5" aria-hidden />
          {dateLabel}
        </Tag>
        <Tag variant="inverse" className="text-[0.7rem]">
          <Clock className="size-3.5" aria-hidden />
          {timeRange}
        </Tag>
      </div>
    </div>
  );
}
