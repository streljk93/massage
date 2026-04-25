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

export type ScrollToIndexOptions = {
  /**
   * `smooth` — как при свайпе/точках. Для клика с карты лучше `auto`, иначе анимация
   * может длиться дольше таймера/scrollend, и `scroll` снова отдаст 0,1,2… родителю.
   */
  behavior?: "auto" | "smooth";
};

export type SliderHandle = {
  scrollToIndex: (index: number, options?: ScrollToIndexOptions) => void;
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
  /**
   * Пока идёт programmatic `scrollIntoView({ behavior: "smooth" })`, `onScroll` даёт
   * промежуточные `scrollLeft` — без этого родитель (карта) получает 0,1,2… и крутит пины
   * подряд, пока анимация не доедет до целевого слайда.
   */
  const programmaticScrollToRef = useRef<number | null>(null);
  const programmaticScrollClearTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const notifyParentIndex = useCallback((index: number) => {
    queueMicrotask(() => {
      onActiveIndexChangeRef.current?.(index);
    });
  }, []);

  const endProgrammaticScroll = useCallback(() => {
    if (programmaticScrollClearTimeoutRef.current != null) {
      clearTimeout(programmaticScrollClearTimeoutRef.current);
      programmaticScrollClearTimeoutRef.current = null;
    }
    programmaticScrollToRef.current = null;
  }, []);

  const scrollToIndex = useCallback(
    (index: number, options?: ScrollToIndexOptions) => {
      const el = scrollerRef.current;
      if (!el) return;
      const behavior = options?.behavior ?? "smooth";
      const clamped = Math.min(slides.length - 1, Math.max(0, index));
      if (activeRef.current === clamped) {
        return;
      }
      const child = el.children[clamped] as HTMLElement | undefined;
      if (behavior === "auto") {
        child?.scrollIntoView({
          behavior: "auto",
          inline: "start",
          block: "nearest",
        });
        activeRef.current = clamped;
        setActive(clamped);
        notifyParentIndex(clamped);
        return;
      }
      programmaticScrollToRef.current = clamped;
      if (programmaticScrollClearTimeoutRef.current != null) {
        clearTimeout(programmaticScrollClearTimeoutRef.current);
      }
      /** Запас, если нет стабильного scrollend: анимация на длинной карусели может быть >0.5s. */
      programmaticScrollClearTimeoutRef.current = setTimeout(() => {
        endProgrammaticScroll();
      }, 3000);
      child?.scrollIntoView({
        behavior: "smooth",
        inline: "start",
        block: "nearest",
      });
      activeRef.current = clamped;
      setActive(clamped);
      notifyParentIndex(clamped);
    },
    [slides.length, notifyParentIndex, endProgrammaticScroll],
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

    const getTargetScrollLeft = (i: number) => {
      const c = el.children[i] as HTMLElement | undefined;
      return c != null ? c.offsetLeft : 0;
    };

    const onScroll = () => {
      if (programmaticScrollToRef.current !== null) {
        const t = programmaticScrollToRef.current;
        if (
          Math.abs(el.scrollLeft - getTargetScrollLeft(t)) <= 4
        ) {
          endProgrammaticScroll();
        }
        return;
      }
      const slideWidth = el.firstElementChild?.clientWidth ?? 1;
      const idx = Math.round(el.scrollLeft / (slideWidth + trackGapPx));
      const next = Math.min(slides.length - 1, Math.max(0, idx));
      if (activeRef.current === next) return;
      activeRef.current = next;
      setActive(next);
      notifyParentIndex(next);
    };

    const onScrollEnd = () => {
      if (programmaticScrollToRef.current == null) {
        return;
      }
      const t = programmaticScrollToRef.current;
      if (Math.abs(el.scrollLeft - getTargetScrollLeft(t)) <= 4) {
        endProgrammaticScroll();
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("scrollend", onScrollEnd);
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("scrollend", onScrollEnd);
      endProgrammaticScroll();
    };
  }, [slides.length, notifyParentIndex, trackGapPx, endProgrammaticScroll]);

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
