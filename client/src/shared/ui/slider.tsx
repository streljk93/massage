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

export type SliderProps = {
  slides: SliderSlide[];
  className?: string;
  /** Дополнительные классы для каждого слайда (по умолчанию на всю ширину скролла). */
  slideClassName?: string;
  showDots?: boolean;
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
    showDots = true,
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
      const gap = 12;
      const idx = Math.round(el.scrollLeft / (slideWidth + gap));
      const next = Math.min(slides.length - 1, Math.max(0, idx));
      if (activeRef.current === next) return;
      activeRef.current = next;
      setActive(next);
      notifyParentIndex(next);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [slides.length, notifyParentIndex]);

  if (slides.length === 0) return null;

  return (
    <div className={cn("w-full", className)}>
      <div
        ref={scrollerRef}
        className={cn(
          "flex min-w-0 touch-pan-x snap-x snap-mandatory items-stretch gap-3 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch]",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {slides.map((slide) => (
          <div
            key={slide.id}
            className={cn(
              "flex min-h-0 min-w-full shrink-0 snap-start flex-col",
              slideClassName,
            )}
          >
            {slide.content}
          </div>
        ))}
      </div>
      {showDots && slides.length > 1 ? (
        <div
          className="mt-1 flex justify-center gap-1"
          role="tablist"
          aria-label={dotsAriaLabel}
        >
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              className={cn(
                motion.interactive,
                "h-1.5 w-1.5 shrink-0 rounded-full",
                i === active ? "bg-foreground" : "bg-muted-foreground/30",
              )}
              onClick={() => scrollToIndex(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
});
