"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/shared/lib";

type BodyZoneOption = {
  slug: string;
  name: string;
};

type BodyZonesSelectorProps = {
  zones: BodyZoneOption[];
  selectedSlugs: string[];
  onChangeSelectedSlugs: (slugs: string[]) => void;
  disabled?: boolean;
  /** Sidebar: без собственного заголовка, компактная обводка. */
  compact?: boolean;
};

type BodySide = "front" | "back";

const HUMAN_SILHOUETTE: Record<BodySide, string> = {
  front:
    "M100 12c-9 0-16 7-16 16c0 7 4 13 10 15v9h12v-9c6-2 10-8 10-15c0-9-7-16-16-16Zm-26 44c-9 2-14 8-14 15v17c0 5 4 9 9 9h4v31c0 7 5 13 12 14v24c0 7 5 12 12 12h6c7 0 12-5 12-12v-24c7-1 12-7 12-14V97h4c5 0 9-4 9-9V71c0-7-5-13-14-15l-12-3H86l-12 3Zm11 124h12v37H85v-37Zm18 0h12v37h-12v-37Z",
  back:
    "M100 12c-9 0-16 7-16 16c0 7 4 13 10 15v9h12v-9c6-2 10-8 10-15c0-9-7-16-16-16Zm-26 44c-9 2-14 8-14 15v17c0 5 4 9 9 9h4v31c0 7 5 13 12 14v24c0 7 5 12 12 12h6c7 0 12-5 12-12v-24c7-1 12-7 12-14V97h4c5 0 9-4 9-9V71c0-7-5-13-14-15l-12-3H86l-12 3Zm11 124h12v37H85v-37Zm18 0h12v37h-12v-37Z",
};

const FULL_BODY_SLUG = "full-body";
const HUMAN_SCALE_TRANSFORM =
  "translate(100 118) scale(1.35) translate(-100 -118)";
const BODY_VIEWBOX = "0 -30 200 300";

const ZONE_PATHS: Record<string, Partial<Record<BodySide, string>>> = {
  head: {
    front: "M88 16h24v24H88z",
    back: "M88 16h24v24H88z",
  },
  face: {
    front: "M90 22h20v14H90z",
  },
  neck: {
    front: "M92 42h16v12H92z",
    back: "M92 42h16v12H92z",
  },
  shoulders: {
    front: "M64 54h72v14H64z",
    back: "M64 54h72v14H64z",
  },
  chest: {
    front: "M76 70h48v24H76z",
  },
  "back-upper": {
    back: "M76 70h48v24H76z",
  },
  abdomen: {
    front: "M80 96h40v30H80z",
  },
  "back-lower": {
    back: "M80 98h40v28H80z",
  },
  glutes: {
    back: "M80 126h40v18H80z",
  },
  "full-body": {
    front: "M70 58h60v158H70z",
    back: "M70 58h60v158H70z",
  },
  arms: {
    front: "M58 68h14v74H58z M128 68h14v74h-14z",
    back: "M58 68h14v74H58z M128 68h14v74h-14z",
  },
  hands: {
    front: "M58 142h14v12H58z M128 142h14v12h-14z",
    back: "M58 142h14v12H58z M128 142h14v12h-14z",
  },
  thighs: {
    front: "M84 146h14v36H84z M102 146h14v36h-14z",
    back: "M84 146h14v36H84z M102 146h14v36h-14z",
  },
  knees: {
    front: "M84 184h14v12H84z M102 184h14v12h-14z",
    back: "M84 184h14v12H84z M102 184h14v12h-14z",
  },
  calves: {
    front: "M84 198h14v20H84z M102 198h14v20h-14z",
    back: "M84 198h14v20H84z M102 198h14v20h-14z",
  },
  feet: {
    front: "M82 220h16v8H82z M102 220h16v8h-16z",
    back: "M82 220h16v8H82z M102 220h16v8h-16z",
  },
};

export function BodyZonesSelector({
  zones,
  selectedSlugs,
  onChangeSelectedSlugs,
  disabled = false,
  compact = false,
}: BodyZonesSelectorProps) {
  const t = useTranslations("bodyZonesSelector");
  const selected = useMemo(() => new Set(selectedSlugs), [selectedSlugs]);
  const zoneSlugs = useMemo(() => zones.map((z) => z.slug), [zones]);
  const nonFullZones = useMemo(
    () => zones.filter((z) => z.slug !== FULL_BODY_SLUG),
    [zones],
  );
  const nonFullSlugs = useMemo(
    () => nonFullZones.map((z) => z.slug),
    [nonFullZones],
  );
  const hasFullBodyOption = useMemo(
    () => zones.some((z) => z.slug === FULL_BODY_SLUG),
    [zones],
  );
  const fullBodySelected = selected.has(FULL_BODY_SLUG);
  const allNonFullSelected = useMemo(
    () =>
      (hasFullBodyOption && fullBodySelected) ||
      (nonFullSlugs.length > 0 &&
        nonFullSlugs.every((slug) => selected.has(slug))),
    [fullBodySelected, hasFullBodyOption, nonFullSlugs, selected],
  );
  const orderedZones = useMemo(() => {
    const full = zones.find((z) => z.slug === FULL_BODY_SLUG);
    const rest = zones.filter((z) => z.slug !== FULL_BODY_SLUG);
    return full ? [full, ...rest] : rest;
  }, [zones]);

  const applySingleSlugToggle = (slug: string) => {
    if (slug === FULL_BODY_SLUG) {
      if (fullBodySelected) {
        onChangeSelectedSlugs([]);
        return;
      }
      onChangeSelectedSlugs([FULL_BODY_SLUG]);
      return;
    }
    const currentNonFull = (
      fullBodySelected ?
        nonFullSlugs
      : selectedSlugs.filter((s) => zoneSlugs.includes(s) && s !== FULL_BODY_SLUG)
    ).filter((s, i, arr) => arr.indexOf(s) === i);
    const nextNonFull = currentNonFull.includes(slug)
      ? currentNonFull.filter((s) => s !== slug)
      : [...currentNonFull, slug];
    const nextAllSelected =
      nonFullSlugs.length > 0 &&
      nonFullSlugs.every((s) => nextNonFull.includes(s));
    const next = hasFullBodyOption && nextAllSelected ? [FULL_BODY_SLUG] : nextNonFull;
    onChangeSelectedSlugs(next);
  };

  const visibleZones = useMemo(
    () => ({
      front: nonFullZones.filter((z) => ZONE_PATHS[z.slug]?.front != null),
      back: nonFullZones.filter((z) => ZONE_PATHS[z.slug]?.back != null),
    }),
    [nonFullZones],
  );

  return (
    <div className={cn("space-y-3", compact && "space-y-2.5")}>
      {compact ? null : (
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{t("title")}</p>
          <p className="text-xs text-muted-foreground">{t("description")}</p>
        </div>
      )}
      <div
        className={cn(
          compact ?
            "rounded-lg bg-muted/30 p-2"
          : "rounded-2xl border border-border/40 bg-card p-3 md:px-3 md:pt-3 md:pb-6",
        )}
      >
        <div className="mb-1 grid grid-cols-2 gap-3 px-2">
          <p className="text-center text-xs font-medium text-muted-foreground">
            {t("front")}
          </p>
          <p className="text-center text-xs font-medium text-muted-foreground">
            {t("back")}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(["front", "back"] as const).map((side) => (
            <svg
              key={side}
              viewBox={BODY_VIEWBOX}
              className="mx-auto h-auto w-full max-w-[15rem]"
            >
              <rect x="0" y="-30" width="200" height="300" fill="transparent" />
              <g transform={HUMAN_SCALE_TRANSFORM}>
                <path
                  d={HUMAN_SILHOUETTE[side]}
                  className="fill-muted/20 stroke-muted-foreground/30 stroke-[1.2]"
                />
                {visibleZones[side].map((z) => {
                  const isSelected =
                    (hasFullBodyOption && fullBodySelected) || selected.has(z.slug);
                  return (
                    <path
                      key={`${side}-${z.slug}`}
                      d={ZONE_PATHS[z.slug]![side]!}
                      role="button"
                      tabIndex={0}
                      onClick={() => !disabled && applySingleSlugToggle(z.slug)}
                      onKeyDown={(e) => {
                        if (disabled) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          applySingleSlugToggle(z.slug);
                        }
                      }}
                      className={cn(
                        "cursor-pointer stroke-[1.5]",
                        isSelected
                          ? "fill-primary/30 stroke-primary"
                          : "fill-muted/40 stroke-muted-foreground/40 hover:fill-primary/10",
                      )}
                    />
                  );
                })}
              </g>
            </svg>
          ))}
        </div>
      </div>
      {zones.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("noZones")}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {orderedZones.map((z) => {
            const active =
              z.slug === FULL_BODY_SLUG ?
                allNonFullSelected
              : ((hasFullBodyOption && fullBodySelected) || selected.has(z.slug));
            return (
              <button
                key={z.slug}
                type="button"
                disabled={disabled}
                onClick={() => applySingleSlugToggle(z.slug)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-60",
                  active
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border/55 bg-card text-foreground hover:bg-muted/40",
                )}
              >
                {z.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export type { BodyZoneOption, BodyZonesSelectorProps };
