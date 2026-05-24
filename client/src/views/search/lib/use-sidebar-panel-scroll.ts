"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

/** Fallback, если не удалось измерить шапку. */
export function searchFiltersSidebarTopPx(): number {
  if (typeof window === "undefined") {
    return 76;
  }
  const rem =
    Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return 4.25 * rem;
}

function readStickyTopPx(): number {
  const header = document.querySelector("header.sticky");
  if (header) {
    return header.getBoundingClientRect().bottom;
  }
  return searchFiltersSidebarTopPx();
}

function readPinInsetsPx(): { top: number; bottom: number } {
  const rem =
    Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  // 1rem — зазор под шапкой; 1.5rem — как `lg:pb-6` у consumer layout
  return { top: rem, bottom: 1.5 * rem };
}

function readViewportHeightPx(): number {
  if (typeof window === "undefined") {
    return 800;
  }
  return window.visualViewport?.height ?? window.innerHeight;
}

type SidebarGeometry = {
  trackTop: number;
  trackBottom: number;
  trackWidth: number;
  panelHeight: number;
  panelTop: number;
  panelBottom: number;
  stickyTop: number;
  pinTopInset: number;
  pinBottomInset: number;
  /** линия pin сверху: низ шапки + отступ */
  pinnedTopLine: number;
  /** линия pin снизу: низ viewport − отступ */
  pinnedBottomLine: number;
  viewportHeight: number;
};

function measureGeometry(
  track: HTMLElement,
  panel: HTMLElement,
): SidebarGeometry {
  const trackRect = track.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const stickyTop = readStickyTopPx();
  const { top: pinTopInset, bottom: pinBottomInset } = readPinInsetsPx();
  const viewportHeight = readViewportHeightPx();
  return {
    trackTop: trackRect.top,
    trackBottom: trackRect.bottom,
    trackWidth: trackRect.width,
    panelHeight: panel.offsetHeight,
    panelTop: panelRect.top,
    panelBottom: panelRect.bottom,
    stickyTop,
    pinTopInset,
    pinBottomInset,
    pinnedTopLine: stickyTop + pinTopInset,
    pinnedBottomLine: viewportHeight - pinBottomInset,
    viewportHeight,
  };
}

/**
 * Три CSS-состояния:
 * - top:    fixed, top = низ шапки + отступ
 * - middle: relative (без top или с top-offset, задаётся один раз)
 * - bottom: fixed, bottom = отступ от низа экрана
 */
export type SidebarPanelPhase = "top" | "middle" | "bottom";

export type SidebarPanelLayout = {
  phase: SidebarPanelPhase;
  relativeTop?: number;
  width: number;
  stickyTop: number;
  pinTopInset: number;
  pinBottomInset: number;
};

type MiddleTopOrigin = "bottom" | "top-exit";

type PanelScrollState = {
  phase: SidebarPanelPhase;
  /** relative top внутри трека; один раз при bottom→middle или top→middle */
  middleTop: number | null;
  /** откуда взяли offset — для пересчёта при resize */
  middleOrigin: MiddleTopOrigin | null;
};

/** offset при выходе из fixed bottom: зависит от viewport, отступов и высоты панели */
function bottomBrowseMiddleTop(geo: SidebarGeometry): number {
  return (
    geo.pinnedBottomLine - geo.panelHeight - geo.trackTop
  );
}

/** offset при выходе из fixed top вниз */
function topExitMiddleTop(geo: SidebarGeometry): number {
  return geo.pinnedTopLine - geo.trackTop;
}

/** Пересчёт offset при смене высоты экрана (шаги 4–5 и после 6→вниз). */
function syncMiddleTopOnResize(
  prev: PanelScrollState,
  geo: SidebarGeometry,
): PanelScrollState {
  if (prev.phase !== "middle" || prev.middleTop === null || !prev.middleOrigin) {
    return prev;
  }
  const nextMiddleTop =
    prev.middleOrigin === "bottom"
      ? bottomBrowseMiddleTop(geo)
      : topExitMiddleTop(geo);
  if (Math.abs(nextMiddleTop - prev.middleTop) < 0.5) {
    return prev;
  }
  return { ...prev, middleTop: nextMiddleTop };
}

function layoutFromState(
  state: PanelScrollState,
  geo: SidebarGeometry,
): SidebarPanelLayout {
  const base = {
    width: geo.trackWidth,
    stickyTop: geo.stickyTop,
    pinTopInset: geo.pinTopInset,
    pinBottomInset: geo.pinBottomInset,
  };
  if (state.phase === "top") {
    return { phase: "top", ...base };
  }
  if (state.phase === "bottom") {
    return { phase: "bottom", ...base };
  }
  if (state.middleTop !== null) {
    return { phase: "middle", relativeTop: state.middleTop, ...base };
  }
  return { phase: "middle", ...base };
}

/**
 * Цикл скролла (8 шагов):
 * 1–2. Вверху / листаем вниз → relative, без top
 * 3.   Низ фильтров у низа экрана (и ниже) → fixed bottom
 * 4–5. Листаем вверх → relative + top (offset один раз)
 * 6.   Верх фильтров у шапки (ещё не конец страницы) → fixed top
 * 7.   Самый верх страницы → relative, без top
 * 8.   Снова вниз → как п.2
 */
function nextPanelState(
  geo: SidebarGeometry,
  scrollDelta: number,
  prev: PanelScrollState,
  prevFilterTop: number | null,
): PanelScrollState {
  const {
    trackTop,
    trackBottom,
    panelBottom,
    pinnedTopLine,
    pinnedBottomLine,
  } = geo;
  const scrollingDown = scrollDelta > 0;
  const scrollingUp = scrollDelta < 0;

  // 7. Самый верх страницы
  if (trackTop >= pinnedTopLine) {
    return { phase: "middle", middleTop: null, middleOrigin: null };
  }

  const filterTop =
    prev.middleTop !== null ? trackTop + prev.middleTop : trackTop;

  // 3. bottom — держим, пока не скроллим вверх (в т.ч. ниже конца трека)
  if (prev.phase === "bottom") {
    if (scrollingUp) {
      // 4. bottom → relative + offset (зависит от viewportHeight и panelHeight)
      return {
        phase: "middle",
        middleTop: bottomBrowseMiddleTop(geo),
        middleOrigin: "bottom",
      };
    }
    return prev;
  }

  if (scrollingDown) {
    // 6 → вниз: fixed top → relative + offset один раз
    if (prev.phase === "top") {
      return {
        phase: "middle",
        middleTop: topExitMiddleTop(geo),
        middleOrigin: "top-exit",
      };
    }
    // 2 → 3: низ фильтров достиг линии pin с отступом от низа
    if (panelBottom <= pinnedBottomLine && trackBottom > pinnedBottomLine) {
      return { phase: "bottom", middleTop: null, middleOrigin: null };
    }
    // 1, 2, 8: relative без top
    return prev;
  }

  if (scrollingUp) {
    // 5 → 6: offset, верх фильтров на sticky-линии (или пересёк её при scroll up)
    if (prev.phase === "middle" && prev.middleTop !== null) {
      const atFilterTop =
        filterTop >= pinnedTopLine - 5 && filterTop <= pinnedTopLine + 1.5;
      const crossedStickyUp =
        prevFilterTop !== null &&
        prevFilterTop < pinnedTopLine + 1.5 &&
        filterTop >= pinnedTopLine - 5;
      if (atFilterTop || crossedStickyUp) {
        return { phase: "top", middleTop: null, middleOrigin: null };
      }
      return prev;
    }
    // 6: держим fixed top до шага 7
    if (prev.phase === "top") {
      return prev;
    }
  }

  return prev;
}

/** Совпадает с Tailwind `lg:` — sidebar sticky только на desktop. */
export const SEARCH_FILTERS_SIDEBAR_DESKTOP_MEDIA =
  "(min-width: 1024px)" as const;

const INITIAL_LAYOUT: SidebarPanelLayout = {
  phase: "middle",
  width: 0,
  stickyTop: searchFiltersSidebarTopPx(),
  pinTopInset: 16,
  pinBottomInset: 24,
};

function layoutsEqual(
  prev: SidebarPanelLayout,
  next: SidebarPanelLayout,
): boolean {
  return (
    prev.phase === next.phase &&
    prev.width === next.width &&
    prev.stickyTop === next.stickyTop &&
    prev.pinTopInset === next.pinTopInset &&
    prev.pinBottomInset === next.pinBottomInset &&
    prev.relativeTop === next.relativeTop
  );
}

/** Сброс inline-стилей при unmount / переходе на mobile. */
function resetPanelInlineStyles(panel: HTMLElement | null): void {
  if (!panel) {
    return;
  }
  panel.style.position = "";
  panel.style.top = "";
  panel.style.bottom = "";
  panel.style.width = "";
  panel.style.transform = "";
  panel.style.zIndex = "";
}

export function sidebarPanelLayoutToStyle(
  layout: SidebarPanelLayout,
): CSSProperties {
  switch (layout.phase) {
    case "top":
      return {
        position: "fixed",
        top: layout.stickyTop + layout.pinTopInset,
        width: layout.width,
        zIndex: 10,
        transform: "translate3d(0px, 0px, 0px)",
      };
    case "bottom":
      return {
        position: "fixed",
        bottom: layout.pinBottomInset,
        width: layout.width,
        zIndex: 10,
        transform: "translate3d(0px, 0px, 0px)",
      };
    case "middle":
      if (layout.relativeTop !== undefined) {
        return {
          position: "relative",
          top: layout.relativeTop,
          transform: "none",
        };
      }
      return {
        position: "relative",
        transform: "none",
      };
  }
}

export function useSidebarPanelScroll(enabled = true) {
  const trackRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const lastScrollYRef = useRef(0);
  const lastFilterTopRef = useRef<number | null>(null);
  const stateRef = useRef<PanelScrollState>({
    phase: "middle",
    middleTop: null,
    middleOrigin: null,
  });
  const layoutRef = useRef<SidebarPanelLayout>(INITIAL_LAYOUT);
  const [layout, setLayout] = useState<SidebarPanelLayout>(INITIAL_LAYOUT);

  useLayoutEffect(() => {
    if (!enabled) {
      stateRef.current = {
        phase: "middle",
        middleTop: null,
        middleOrigin: null,
      };
      lastFilterTopRef.current = null;
      layoutRef.current = INITIAL_LAYOUT;
      resetPanelInlineStyles(panelRef.current);
      return;
    }

    const track = trackRef.current;
    const panel = panelRef.current;
    if (!track || !panel) {
      return;
    }

    let cancelled = false;
    lastScrollYRef.current = window.scrollY;
    let raf = 0;

    const commitLayout = (nextLayout: SidebarPanelLayout) => {
      if (cancelled || layoutsEqual(layoutRef.current, nextLayout)) {
        return;
      }
      layoutRef.current = nextLayout;
      setLayout(nextLayout);
    };

    const update = () => {
      raf = 0;
      if (cancelled) {
        return;
      }

      const trackEl = trackRef.current;
      const panelEl = panelRef.current;
      if (!trackEl || !panelEl) {
        return;
      }

      const scrollY = window.scrollY;
      const scrollDelta = scrollY - lastScrollYRef.current;
      lastScrollYRef.current = scrollY;

      const geo = measureGeometry(trackEl, panelEl);
      const filterTop =
        stateRef.current.middleTop !== null
          ? geo.trackTop + stateRef.current.middleTop
          : geo.trackTop;

      let next = nextPanelState(
        geo,
        scrollDelta,
        stateRef.current,
        lastFilterTopRef.current,
      );
      if (scrollDelta === 0) {
        next = syncMiddleTopOnResize(next, geo);
      }
      stateRef.current = next;
      lastFilterTopRef.current = filterTop;
      commitLayout(layoutFromState(stateRef.current, geo));
    };

    const schedule = () => {
      if (cancelled || raf !== 0) {
        return;
      }
      raf = window.requestAnimationFrame(update);
    };

    update();

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener("resize", schedule);

    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(track);
    resizeObserver.observe(panel);

    return () => {
      cancelled = true;
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      visualViewport?.removeEventListener("resize", schedule);
      resizeObserver.disconnect();
      if (raf !== 0) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      }
      resetPanelInlineStyles(panel);
      stateRef.current = {
        phase: "middle",
        middleTop: null,
        middleOrigin: null,
      };
      lastFilterTopRef.current = null;
    };
  }, [enabled]);

  return {
    trackRef,
    panelRef,
    panelStyle: enabled ? sidebarPanelLayoutToStyle(layout) : undefined,
  };
}
