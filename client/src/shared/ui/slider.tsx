"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
  type ReactNode,
} from "react";
import { cn, motion } from "../lib";

export type SliderSlide = {
  id: string;
  content: ReactNode;
};

export type SliderHandle = {
  scrollToIndex: (index: number) => void;
};

export type SliderDotsPlacement = "below" | "overlay";

export type SliderProps = {
  slides: SliderSlide[];
  className?: string;
  /** Дополнительные классы для каждого слайда (по умолчанию на всю ширину скролла). */
  slideClassName?: string;
  /**
   * Ширина слайда (Tailwind). По умолчанию `basis-full` + `min-w-0` на треке — ровно одна карточка на
   * экран без раздувания от длинного текста. Для «peek» / нескольких колонок переопределите, например:
   * `min-w-0 w-[82%] sm:w-[calc((100%-0.75rem)/2)]` при `trackGapClassName="gap-3"` и `trackGapPx={12}`.
   */
  slideMinWidthClassName?: string;
  /** Класс `gap` между слайдами на треке. Должен соответствовать `trackGapPx`. По умолчанию `gap-3`. */
  trackGapClassName?: string;
  /** Расстояние между слайдами в px (для расчёта активной точки). По умолчанию 12 = `gap-3`. */
  trackGapPx?: number;
  showDots?: boolean;
  /**
   * `below` — точки под каруселью (по умолчанию).
   * `overlay` — внутри области слайда, у нижнего края (например поверх промо-карточки).
   */
  dotsPlacement?: SliderDotsPlacement;
  /** Подпись для списка точек (a11y). */
  dotsAriaLabel?: string;
  /** Вызывается при смене активного слайда (скролл или программная прокрутка). */
  onActiveIndexChange?: (index: number) => void;
};

export const Slider = forwardRef<SliderHandle, SliderProps>(function Slider(
  {
    slides,
    className,
    slideClassName,
    slideMinWidthClassName,
    trackGapClassName = "gap-3",
    trackGapPx = 12,
    showDots = true,
    dotsPlacement = "below",
    dotsAriaLabel,
    onActiveIndexChange,
  },
  ref,
) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  /** Синхронное зеркало `active` для обработчика scroll без чтения state внутри setState. */
  const activeRef = useRef(0);
  const onActiveIndexChangeRef = useRef(onActiveIndexChange);
  onActiveIndexChangeRef.current = onActiveIndexChange;

  const notifyParentIndex = useCallback((index: number) => {
    queueMicrotask(() => {
      onActiveIndexChangeRef.current?.(index);
    });
  }, []);

  const scrollToIndex = useCallback(
    (index: number) => {
      const el = scrollerRef.current;
      if (!el) return;
      const clamped = Math.min(slides.length - 1, Math.max(0, index));
      const child = el.children[clamped] as HTMLElement | undefined;
      child?.scrollIntoView({
        behavior: "smooth",
        inline: "start",
        block: "nearest",
      });
      if (activeRef.current !== clamped) {
        activeRef.current = clamped;
        setActive(clamped);
        notifyParentIndex(clamped);
      }
    },
    [slides.length, notifyParentIndex],
  );

  useImperativeHandle(
    ref,
    () => ({
      scrollToIndex,
    }),
    [scrollToIndex],
  );

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onScroll = () => {
      const slideWidth = el.firstElementChild?.clientWidth ?? 1;
      const idx = Math.round(el.scrollLeft / (slideWidth + trackGapPx));
      const next = Math.min(slides.length - 1, Math.max(0, idx));
      if (activeRef.current === next) return;
      activeRef.current = next;
      setActive(next);
      notifyParentIndex(next);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [slides.length, notifyParentIndex, trackGapPx]);

  if (slides.length === 0) return null;

  const dotButtons = slides.map((slide, i) => (
    <button
      key={slide.id}
      type="button"
      role="tab"
      aria-selected={i === active}
      className={cn(
        motion.interactive,
        "shrink-0 rounded-full transition-[width,background-color]",
        dotsPlacement === "overlay"
          ? cn(
              "h-1.5",
              i === active
                ? "w-4 bg-foreground"
                : "w-1.5 bg-muted-foreground/40",
            )
          : cn(
              "h-1.5 w-1.5",
              i === active ? "bg-foreground" : "bg-muted-foreground/30",
            ),
      )}
      onClick={() => scrollToIndex(i)}
    />
  ));

  const dotsRow =
    showDots && slides.length > 1 ? (
      dotsPlacement === "overlay" ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center px-3"
          role="tablist"
          aria-label={dotsAriaLabel}
        >
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-border/35 bg-card/80 px-2 py-1 backdrop-blur-sm">
            {dotButtons}
          </div>
        </div>
      ) : (
        <div
          className="mt-1 flex justify-center gap-1"
          role="tablist"
          aria-label={dotsAriaLabel}
        >
          {dotButtons}
        </div>
      )
    ) : null;

  return (
    <div className={cn("w-full", className)}>
      <div className={cn(dotsPlacement === "overlay" && "relative")}>
        <div
          ref={scrollerRef}
          className={cn(
            "flex min-w-0 touch-pan-x snap-x snap-mandatory items-stretch overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]",
            trackGapClassName,
            dotsPlacement === "below" && "pb-1",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
          {slides.map((slide) => (
            <div
              key={slide.id}
              className={cn(
                "flex min-h-0 min-w-0 shrink-0 snap-start flex-col",
                slideMinWidthClassName ?? "basis-full",
                slideClassName,
              )}
            >
              {slide.content}
            </div>
          ))}
        </div>
        {dotsPlacement === "overlay" ? dotsRow : null}
      </div>
      {dotsPlacement === "below" ? dotsRow : null}
    </div>
  );
});
