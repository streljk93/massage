"use client";

import {
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { catalogFiltersPanelWidthClass } from "@/entities/catalog";
import { cn } from "@/shared/lib";
import { useMediaQuery } from "@/shared/lib/use-media-query";
import {
  SEARCH_FILTERS_SIDEBAR_DESKTOP_MEDIA,
  useSidebarPanelScroll,
} from "../lib/use-sidebar-panel-scroll";

type SearchFiltersSidebarProps = {
  ariaLabel: string;
  children: ReactNode;
  /** Подсказка справа от колонки (напр. счётчик выдачи), только desktop. */
  hint?: ReactNode;
};

function readRootRemPx(): number {
  if (typeof globalThis.window === "undefined") {
    return 16;
  }
  const raw = getComputedStyle(document.documentElement).fontSize;
  return Number.parseFloat(raw) || 16;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Desktop sidebar фильтров: трек на высоту списка, aside — top / middle / bottom.
 * Позиция подсказки по Y — по последнему клику/фокусу в панели; при кратком снятии hint
 * (между сменами фильтров) якорь не сбрасывается.
 */
export function SearchFiltersSidebar({
  ariaLabel,
  children,
  hint,
}: SearchFiltersSidebarProps) {
  const isDesktop = useMediaQuery(SEARCH_FILTERS_SIDEBAR_DESKTOP_MEDIA);
  const { trackRef, panelRef, panelStyle } = useSidebarPanelScroll(isDesktop);
  /** Смещение от верха `<aside>` до точки якоря, px. */
  const [anchorYPx, setAnchorYPx] = useState<number | null>(null);

  /** Не давать focusCapture перетирать координаты сразу после pointer (radix/чекбоксы). */
  const pointerBiasUntilMsRef = useRef(0);

  const applyClientYToAnchor = useCallback((clientY: number) => {
    const panel = panelRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const h = r.height;
    if (h <= 0) return;
    const margin = 12;
    const maxY = Math.max(margin, h - margin);
    const y = clientY - r.top;
    setAnchorYPx(clamp(y, margin, maxY));
  }, []);

  const onFilterSurfacePointerDownCapture = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDesktop) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      pointerBiasUntilMsRef.current = performance.now() + 380;
      applyClientYToAnchor(event.clientY);
    },
    [applyClientYToAnchor, isDesktop],
  );

  const onFilterSurfaceFocusCapture = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      if (!isDesktop) return;
      if (performance.now() < pointerBiasUntilMsRef.current) return;
      const { target } = event;
      if (!(target instanceof globalThis.Element)) return;
      const rect = target.getBoundingClientRect();
      if (
        rect.width === 0 &&
        rect.height === 0 &&
        rect.top === 0 &&
        rect.left === 0
      ) {
        return;
      }
      const centerY = rect.top + rect.height / 2;
      applyClientYToAnchor(centerY);
    },
    [applyClientYToAnchor, isDesktop],
  );

  /** Не использовать `hint` в deps — на каждый рендер новый элемент. */
  const hasHint = Boolean(hint);

  useLayoutEffect(() => {
    if (!hasHint) return;
    const panel = panelRef.current;
    if (!panel) return;
    const h = panel.getBoundingClientRect().height;
    const margin = 12;
    if (h <= margin * 2) return;
    const maxY = Math.max(margin, h - margin);

    setAnchorYPx((prev) => {
      if (prev === null) {
        return clamp(readRootRemPx() * 5, margin, maxY);
      }
      return clamp(prev, margin, maxY);
    });
  }, [hasHint]);

  const anchorTopStyle =
    anchorYPx !== null ?
      `${anchorYPx}px`
    : `${readRootRemPx() * 5}px`;

  return (
    <div
      ref={trackRef}
      className={cn(
        "relative hidden shrink-0 self-stretch lg:block",
        catalogFiltersPanelWidthClass,
      )}
    >
      <aside
        ref={panelRef}
        aria-label={ariaLabel}
        className="relative w-full"
        style={panelStyle}
      >
        <div
          onPointerDownCapture={
            isDesktop ? onFilterSurfacePointerDownCapture : undefined
          }
          onFocusCapture={
            isDesktop ? onFilterSurfaceFocusCapture : undefined
          }
        >
          {children}
        </div>
        {hint ?
          <div className="pointer-events-none absolute inset-0 z-[5] overflow-visible">
            <div
              className="absolute right-0 flex w-0 -translate-y-1/2 justify-end"
              style={{ top: anchorTopStyle }}
            >
              {hint}
            </div>
          </div>
        : null}
      </aside>
    </div>
  );
}
