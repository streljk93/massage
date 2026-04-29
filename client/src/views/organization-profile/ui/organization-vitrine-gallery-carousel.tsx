"use client";

import { useMemo, useState } from "react";
import {
  FullScreenPhotoGallery,
  Slider,
  type SliderSlide,
} from "@/shared/ui";

export type OrganizationVitrineGalleryCarouselProps = {
  items: { src: string; alt: string }[];
  sliderAriaLabel: string;
  openFullscreenLabel: string;
  fullscreenTitle: string;
  fullscreenCloseLabel: string;
  formatPhotoProgress?: (indexOneBased: number, total: number) => string;
  /**
   * Точки-индикаторы карусели. По умолчанию — только при двух и более фото.
   * На шапке профиля салона обычно `false`.
   */
  showDots?: boolean;
  dotsPlacement?: "overlay" | "below";
  /** Смещение overlay-dots вверх (Tailwind), напр. выше плашки с кнопками. */
  dotsOverlayContainerClassName?: string;
  dotsOverlayVariant?: "default" | "onMedia";
  className?: string;
  /** Доп. классы на корневой слайд (высота от родителя). */
  slideClassName?: string;
};

export function OrganizationVitrineGalleryCarousel({
  items,
  sliderAriaLabel,
  openFullscreenLabel,
  fullscreenTitle,
  fullscreenCloseLabel,
  formatPhotoProgress,
  showDots: showDotsProp,
  dotsPlacement = "overlay",
  dotsOverlayContainerClassName,
  dotsOverlayVariant,
  className,
  slideClassName,
}: OrganizationVitrineGalleryCarouselProps) {
  const [lightbox, setLightbox] = useState<{ open: boolean; index: number }>({
    open: false,
    index: 0,
  });

  const slides: SliderSlide[] = useMemo(
    () =>
      items.map((item, i) => ({
        id: `org-vitrine-${i}`,
        content: (
          <button
            type="button"
            className="relative block size-full min-h-0 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            aria-label={openFullscreenLabel}
            onClick={() => setLightbox({ open: true, index: i })}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.src}
              alt={item.alt}
              className="absolute inset-0 size-full object-cover"
              draggable={false}
            />
          </button>
        ),
      })),
    [items, openFullscreenLabel],
  );

  if (items.length === 0) {
    return null;
  }

  const showDots =
    showDotsProp !== undefined ? showDotsProp : items.length > 1;

  return (
    <>
      <Slider
        className={className}
        slides={slides}
        showDots={showDots}
        dotsPlacement={dotsPlacement}
        dotsAriaLabel={sliderAriaLabel}
        slideMinWidthClassName="h-full min-h-0 basis-full"
        slideClassName={slideClassName}
        dotsOverlayContainerClassName={dotsOverlayContainerClassName}
        dotsOverlayVariant={dotsOverlayVariant}
      />
      <FullScreenPhotoGallery
        open={lightbox.open}
        onOpenChange={(open) => setLightbox((s) => ({ ...s, open }))}
        items={items}
        initialIndex={lightbox.index}
        closeLabel={fullscreenCloseLabel}
        title={fullscreenTitle}
        formatPhotoProgress={formatPhotoProgress}
      />
    </>
  );
}
