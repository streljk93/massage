"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn, motion } from "../lib";

export type SliderSlide = {
  id: string;
  content: ReactNode;
};

export type SliderProps = {
  slides: SliderSlide[];
  className?: string;
  showDots?: boolean;
};

export function Slider({ slides, className, showDots = true }: SliderProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const scrollToIndex = useCallback((index: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const child = el.children[index] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onScroll = () => {
      const slideWidth = el.firstElementChild?.clientWidth ?? 1;
      const gap = 12;
      const idx = Math.round(el.scrollLeft / (slideWidth + gap));
      setActive(Math.min(slides.length - 1, Math.max(0, idx)));
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [slides.length]);

  if (slides.length === 0) return null;

  return (
    <div className={cn("w-full", className)}>
      <div
        ref={scrollerRef}
        className={cn(
          "flex snap-x snap-mandatory items-stretch gap-3 overflow-x-auto pb-1",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {slides.map((slide) => (
          <div
            key={slide.id}
            className="flex min-h-0 min-w-full shrink-0 snap-start flex-col"
          >
            {slide.content}
          </div>
        ))}
      </div>
      {showDots && slides.length > 1 ? (
        <div
          className="mt-2 flex justify-center gap-1.5"
          role="tablist"
          aria-label="Слайды баннера"
        >
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              className={cn(
                motion.interactive,
                "size-2 rounded-full",
                i === active ? "bg-foreground" : "bg-muted-foreground/30",
              )}
              onClick={() => scrollToIndex(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
