"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Dialog as DialogPrimitive, VisuallyHidden } from "radix-ui";
import { X } from "lucide-react";
import { cn, motion } from "@/shared/lib";
import { Button } from "./button";

export type FullScreenPhotoGalleryItem = {
  src: string;
  alt: string;
};

export type FullScreenPhotoGalleryProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: FullScreenPhotoGalleryItem[];
  /** Индекс снимка при открытии */
  initialIndex?: number;
  /** Подпись для кнопки закрытия (a11y). */
  closeLabel: string;
  /** Краткий заголовок для скринридеров (например «Галерея салона»). */
  title: string;
  /** Подпись «фото i из n» для скринридеров (например из next-intl). */
  formatPhotoProgress?: (indexOneBased: number, total: number) => string;
};

export function FullScreenPhotoGallery({
  open,
  onOpenChange,
  items,
  initialIndex = 0,
  closeLabel,
  title,
  formatPhotoProgress,
}: FullScreenPhotoGalleryProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [visibleIndex, setVisibleIndex] = useState(0);

  const scrollToIndex = useCallback((index: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const clamped = Math.min(items.length - 1, Math.max(0, index));
    el.scrollTo({ left: clamped * w, behavior: "auto" });
    setVisibleIndex(clamped);
  }, [items.length]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const start = Math.min(items.length - 1, Math.max(0, initialIndex));
    requestAnimationFrame(() => {
      scrollToIndex(start);
    });
  }, [open, initialIndex, items.length, scrollToIndex]);

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || items.length === 0) return;
    const w = el.clientWidth || 1;
    const idx = Math.round(el.scrollLeft / w);
    const clamped = Math.min(items.length - 1, Math.max(0, idx));
    setVisibleIndex((v) => (v === clamped ? v : clamped));
  }, [items.length]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (items.length <= 1) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        scrollToIndex(visibleIndex - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        scrollToIndex(visibleIndex + 1);
      }
    },
    [items.length, scrollToIndex, visibleIndex],
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0 fixed inset-0 isolate z-50 bg-black/95 duration-150"
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-0 z-50 flex max-h-[100dvh] flex-col bg-transparent outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          )}
          onKeyDown={onKeyDown}
        >
          <VisuallyHidden.Root asChild>
            <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
          </VisuallyHidden.Root>
          <VisuallyHidden.Root asChild>
            <DialogPrimitive.Description>
              {items.length > 1
                ? (formatPhotoProgress ?? ((i, tot) => `Photo ${i} of ${tot}`))(
                    visibleIndex + 1,
                    items.length,
                  )
                : title}
            </DialogPrimitive.Description>
          </VisuallyHidden.Root>

          <div className="flex h-14 shrink-0 items-center justify-end px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <DialogPrimitive.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  motion.interactive,
                  "size-11 rounded-full text-white hover:bg-white/10 hover:text-white",
                )}
                aria-label={closeLabel}
              >
                <X className="size-6" aria-hidden />
              </Button>
            </DialogPrimitive.Close>
          </div>

          <div
            ref={scrollerRef}
            onScroll={onScroll}
            className={cn(
              "min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [-webkit-overflow-scrolling:touch]",
              "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            )}
          >
            <div className="flex h-full w-max">
              {items.map((item, i) => (
                <div
                  key={`${item.src}-${i}`}
                  className="h-full w-screen shrink-0 snap-start"
                >
                  <div className="flex h-[calc(100dvh-3.5rem-env(safe-area-inset-bottom,0px))] max-h-full items-center justify-center overflow-y-auto px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- fullscreen просмотр произвольных URL */}
                    <img
                      src={item.src}
                      alt={item.alt}
                      className="max-h-full max-w-full object-contain"
                      draggable={false}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {items.length > 1 ? (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[1] flex justify-center"
              aria-hidden
            >
              <div className="pointer-events-auto flex gap-1.5 rounded-full border border-white/20 bg-black/40 px-2 py-1 backdrop-blur-sm">
                {items.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={cn(
                      motion.interactive,
                      "h-1.5 rounded-full transition-[width,background-color]",
                      i === visibleIndex ? "w-4 bg-white" : "w-1.5 bg-white/35",
                    )}
                    onClick={() => scrollToIndex(i)}
                    aria-label={`${i + 1}`}
                    aria-current={i === visibleIndex}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
