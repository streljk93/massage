"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  memo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import MarkerClusterGroup from "react-leaflet-markercluster";
import "react-leaflet-markercluster/styles";
import { cn } from "@/shared/lib";

export type SearchMapMarkerItem = {
  id: string;
  lat: number;
  lng: number;
  imageSrc: string;
  name: string;
  rating: number;
  /** Вне зоны радиуса: меньше непрозрачность, но маркер остаётся на карте. */
  dimmed?: boolean;
};

type SearchResultsLeafletMapProps = {
  items: SearchMapMarkerItem[];
  /** `null` — ничего не выделено, без fly к маркеру. */
  selectedIndex: number | null;
  onMarkerSelect: (index: number) => void;
  /** Подпись для маркера «моё местоположение» (a11y) */
  userLocationAriaLabel?: string;
  /** Координаты пользователя с родителя (геолокация поднимается на страницу — см. кнопку «ко мне»). */
  userPosition: [number, number] | null;
  /**
   * Передаёт функцию `flyTo` по готовности карты (`next/dynamic` не пробрасывает ref).
   */
  onMapFlyReady?: (flyTo: (p: [number, number]) => void) => void;
  /**
   * Режим фокуса: при `true` карта интерактивна только пока в фокусе; без фокуса страница
   * прокручивается поверх карты. Прокрутка над картой без фокуса кратко показывает
   * `interactionGateHint`. Клик по карте — фокус и подсветка; клик снаружи или Escape — снятие фокуса.
   */
  interactionGate?: boolean;
  interactionGateHint?: string;
  /**
   * Круг `L.circle` в метрах; радиус задаётся с родителя (ползунок), центр — центр карты.
   */
  radiusPickerMode?: boolean;
  /** Стартовый центр (например из URL) и зум, если радиус-режим. */
  radiusMapCenter?: [number, number];
  radiusMapInitialZoom?: number;
  /** Радиус зоны в метрах (значение ползунка). */
  radiusPickerMeters?: number;
  onRadiusSelectionChange?: (state: {
    center: [number, number];
    radiusM: number;
  }) => void;
  /**
   * Клик по тайлу/пустой области карты (не по `leaflet-marker-icon` — пины и кластеры).
   * Не вызывать в обработчике тяжёлых операций: подписка с `ref` на колбэк.
   */
  onMapBackgroundClick?: () => void;
};

const PHU_QUOC_CENTER: [number, number] = [10.223, 103.968];

const SCROLL_HINT_AUTO_HIDE_MS = 2000;

function MapRadiusMetersOverlay({
  mapCenter: initialCenter,
  initialZoom,
  radiusM,
  onChange,
}: {
  mapCenter: [number, number];
  initialZoom: number;
  radiusM: number;
  onChange: (p: { center: [number, number]; radiusM: number }) => void;
}) {
  const map = useMap();
  const onChangeRef = useRef(onChange);
  const radiusMRef = useRef(radiusM);
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useLayoutEffect(() => {
    radiusMRef.current = radiusM;
  }, [radiusM]);
  const [center, setCenter] = useState<[number, number] | null>(null);
  const didInitRef = useRef(false);
  const circleRef = useRef<L.Circle | null>(null);
  const pointRef = useRef<L.CircleMarker | null>(null);

  /** Сразу при панорамировании и зуме — круг следует без ожидания `moveend`. */
  const syncCenterFromMap = useCallback(() => {
    const c = map.getCenter();
    setCenter([c.lat, c.lng]);
  }, [map]);

  const commitToParent = useCallback(() => {
    const c = map.getCenter();
    const cc: [number, number] = [c.lat, c.lng];
    setCenter(cc);
    onChangeRef.current({ center: cc, radiusM: radiusMRef.current });
  }, [map]);

  const emitInitial = useCallback(() => {
    commitToParent();
  }, [commitToParent]);

  useMapEvents({
    move: syncCenterFromMap,
    zoom: syncCenterFromMap,
    moveend: commitToParent,
  });

  useEffect(() => {
    map.whenReady(() => {
      if (didInitRef.current) {
        return;
      }
      didInitRef.current = true;
      const ll = L.latLng(initialCenter[0], initialCenter[1]);
      map.setView(ll, initialZoom, { animate: false });
      map.invalidateSize();
      requestAnimationFrame(() => {
        emitInitial();
      });
    });
  }, [map, initialCenter, initialZoom, emitInitial]);

  const c = center ?? initialCenter;
  const c0 = c[0];
  const c1 = c[1];
  useLayoutEffect(() => {
    if (circleRef.current == null) {
      circleRef.current = L.circle(
        L.latLng(c0, c1),
        {
          radius: radiusM,
          color: "#2563eb",
          fillColor: "#2563eb",
          fillOpacity: 0.12,
          weight: 2,
        },
      );
      pointRef.current = L.circleMarker(L.latLng(c0, c1), {
        radius: 7,
        color: "#ffffff",
        fillColor: "#2563eb",
        fillOpacity: 1,
        weight: 3,
      });
      map.addLayer(circleRef.current);
      map.addLayer(pointRef.current);
    } else {
      const ll = L.latLng(c0, c1);
      circleRef.current.setLatLng(ll);
      circleRef.current.setRadius(radiusM);
      if (pointRef.current != null) {
        pointRef.current.setLatLng(ll);
      }
    }
  }, [map, c0, c1, radiusM]);

  useLayoutEffect(
    () => () => {
      if (circleRef.current != null) {
        try {
          map.removeLayer(circleRef.current);
        } catch {
          /* unmounted map */
        }
        circleRef.current = null;
      }
      if (pointRef.current != null) {
        try {
          map.removeLayer(pointRef.current);
        } catch {
          /* unmounted map */
        }
        pointRef.current = null;
      }
    },
    [map],
  );

  return null;
}

function escapeAttr(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * `dimmed` не в HTML — тот же `L.divIcon` остаётся в кеше, иначе при смене радиуса
 * маркеры и кластер перерисовываются с морганием.
 */
function buildSearchMapPinIcon(
  selected: boolean,
  imageSrc: string,
  rating: number,
) {
  const pad = 5;
  const gap = 6;
  const avatarSize = selected ? 40 : 34;
  const ratingText = rating.toFixed(1);
  const fontSize = 12;
  const textW = Math.max(30, ratingText.length * 7);
  const totalW = pad + avatarSize + gap + textW + pad;
  const totalH = pad * 2 + avatarSize;
  /** Точка на карте — центр аватара. */
  const anchorX = pad + avatarSize / 2;
  const anchorY = pad + avatarSize / 2;
  const shadow = selected
    ? "0 2px 10px rgba(0,0,0,.16),0 0 0 2px #fff,0 0 0 4px var(--primary)"
    : "0 2px 8px rgba(0,0,0,.14)";
  const src = escapeAttr(imageSrc);
  return L.divIcon({
    className: "search-map-pin",
    html: `<div style="display:flex;align-items:center;box-sizing:border-box;gap:${gap}px;width:${totalW}px;height:${totalH}px;padding:${pad}px;background:#fff;border-radius:9999px;box-shadow:${shadow};opacity:1">
      <div style="width:${avatarSize}px;height:${avatarSize}px;border-radius:50%;overflow:hidden;flex-shrink:0;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.12)">
        <img src="${src}" alt="" width="${avatarSize}" height="${avatarSize}" style="display:block;width:100%;height:100%;object-fit:cover"/>
      </div>
      <span style="font-weight:600;font-size:${fontSize}px;line-height:1;color:#2f2f2f;white-space:nowrap;font-family:system-ui,sans-serif">${ratingText}</span>
    </div>`,
    iconSize: [totalW, totalH],
    iconAnchor: [anchorX, anchorY],
  });
}

const PIN_ICON_CACHE_MAX = 200;
const searchMapPinIconCache = new Map<string, L.DivIcon>();

function getSearchMapPinIcon(
  selected: boolean,
  imageSrc: string,
  rating: number,
) {
  const k = `${selected ? 1 : 0}\0${imageSrc}\0${rating.toFixed(1)}`;
  let icon = searchMapPinIconCache.get(k);
  if (icon == null) {
    if (searchMapPinIconCache.size >= PIN_ICON_CACHE_MAX) {
      searchMapPinIconCache.clear();
    }
    icon = buildSearchMapPinIcon(selected, imageSrc, rating);
    searchMapPinIconCache.set(k, icon);
  }
  return icon;
}

/**
 * Схлопывание близких точек: круг с числом (как single-brand cluster на картах).
 * `cluster` — экземпляр из leaflet.markercluster.
 */
function createSearchMapClusterIcon(
  cluster: { getChildCount: () => number },
): L.DivIcon {
  const n = cluster.getChildCount();
  const w = n >= 100 ? 48 : 44;
  return L.divIcon({
    className: "search-map-cluster-icon",
    html: `<div style="box-sizing:border-box;width:${w}px;height:${w}px;display:flex;align-items:center;justify-content:center;border-radius:9999px;background:var(--primary);color:var(--primary-foreground);font-size:15px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.2);font-family:system-ui,sans-serif">${n}</div>`,
    iconSize: L.point(w, w),
    iconAnchor: L.point(w / 2, w / 2),
  });
}

function mapClusterMaxRadiusForZoom(zoom: number): number {
  if (zoom <= 9) {
    return 100;
  }
  if (zoom <= 11) {
    return 80;
  }
  if (zoom <= 13) {
    return 60;
  }
  return 44;
}

type SearchMapPinsLayerProps = {
  items: SearchMapMarkerItem[];
  selectedIndex: number | null;
  clusterMarkerClickByIndex: Record<number, { click: () => void }>;
  /** В режиме радиуса `false` — без анимации merge/split кластеров. */
  clusterAnimate: boolean;
  userPosition: [number, number] | null;
  userLocationAriaLabel?: string;
};

const SearchMapPinsLayer = memo(function SearchMapPinsLayer({
  items,
  selectedIndex,
  clusterMarkerClickByIndex,
  clusterAnimate,
  userPosition,
  userLocationAriaLabel,
}: SearchMapPinsLayerProps) {
  const activeMarkerIndex =
    selectedIndex == null || items.length === 0
      ? null
      : Math.min(items.length - 1, Math.max(0, selectedIndex));
  const clusteredEntries = useMemo(
    () =>
      items
        .map((item, index) => ({ item, index }))
        .filter(
          ({ index }) =>
            activeMarkerIndex == null || index !== activeMarkerIndex,
        ),
    [items, activeMarkerIndex],
  );
  const selectedMapItem =
    activeMarkerIndex != null ? items[activeMarkerIndex] : null;

  return (
    <>
      {items.length > 0 ?
        <>
          {clusteredEntries.length > 0 ?
            /* Без `disableClusteringAtZoom`: на большом зуме кластеризация иначе отключается, маркеры
               в одной точке накладываются, а `spiderfy` действует только по сгруппированным. */
            <MarkerClusterGroup
              chunkedLoading={items.length > 150}
              showCoverageOnHover={false}
              zoomToBoundsOnClick
              spiderfyOnMaxZoom
              removeOutsideVisibleBounds
              animate={clusterAnimate}
              maxClusterRadius={mapClusterMaxRadiusForZoom}
              iconCreateFunction={createSearchMapClusterIcon}
              spiderfyDistanceMultiplier={1.35}
            >
              {clusteredEntries.map(({ item, index }) => (
                <Marker
                  key={`c-${item.id}`}
                  position={[item.lat, item.lng]}
                  zIndexOffset={0}
                  opacity={item.dimmed ? 0.38 : 1}
                  icon={getSearchMapPinIcon(
                    false,
                    item.imageSrc,
                    item.rating,
                  )}
                  eventHandlers={clusterMarkerClickByIndex[index]}
                />
              ))}
            </MarkerClusterGroup>
          : null}
          {selectedMapItem != null && activeMarkerIndex != null ?
            <Marker
              key={`s-${selectedMapItem.id}`}
              position={[selectedMapItem.lat, selectedMapItem.lng]}
              zIndexOffset={2000}
              opacity={selectedMapItem.dimmed ? 0.38 : 1}
              icon={getSearchMapPinIcon(
                true,
                selectedMapItem.imageSrc,
                selectedMapItem.rating,
              )}
              eventHandlers={clusterMarkerClickByIndex[activeMarkerIndex]}
            />
          : null}
        </>
      : null}
      {userPosition ? (
        <CircleMarker
          center={userPosition}
          radius={11}
          pathOptions={{
            color: "#ffffff",
            fillColor: "#2563eb",
            fillOpacity: 1,
            weight: 3,
          }}
        >
          {userLocationAriaLabel ? (
            <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
              {userLocationAriaLabel}
            </Tooltip>
          ) : null}
        </CircleMarker>
      ) : null}
    </>
  );
}, (a, b) => (
  a.items === b.items &&
  a.selectedIndex === b.selectedIndex &&
  a.clusterMarkerClickByIndex === b.clusterMarkerClickByIndex &&
  a.clusterAnimate === b.clusterAnimate &&
  a.userPosition === b.userPosition &&
  a.userLocationAriaLabel === b.userLocationAriaLabel
));

const MAP_FOLLOW_ZOOM = 15;
/** Не панорамировать снова, если центр уже у цели (рядом с соседним пином — меньше дёрганья). */
const MAP_FOLLOW_MIN_MOVE_METERS = 80;

function MapViewSync({
  items,
  selectedIndex,
  userPositionRef,
}: {
  items: SearchMapMarkerItem[];
  selectedIndex: number | null;
  userPositionRef: MutableRefObject<[number, number] | null>;
}) {
  const map = useMap();
  const itemsKey = useMemo(() => items.map((i) => i.id).join("|"), [items]);
  const prevItemsKey = useRef<string | null>(null);
  const itemsRef = useRef(items);
  useLayoutEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const activeIndex =
    selectedIndex == null || items.length === 0
      ? null
      : Math.min(items.length - 1, Math.max(0, selectedIndex));

  useEffect(() => {
    const list = itemsRef.current;
    if (list.length === 0) {
      return;
    }

    const isNewList = prevItemsKey.current !== itemsKey;

    if (isNewList) {
      prevItemsKey.current = itemsKey;
      const bounds = L.latLngBounds(
        list.map((i) => [i.lat, i.lng] as [number, number]),
      );
      const u = userPositionRef.current;
      if (u) {
        bounds.extend(u);
      }
      map.fitBounds(bounds, { padding: [56, 56], maxZoom: MAP_FOLLOW_ZOOM });
      return;
    }

    if (activeIndex == null) {
      return;
    }
    const item = list[activeIndex];
    const target = L.latLng(item.lat, item.lng);
    const center = map.getCenter();
    if (
      center.distanceTo(target) < MAP_FOLLOW_MIN_MOVE_METERS &&
      Math.round(map.getZoom()) === MAP_FOLLOW_ZOOM
    ) {
      return;
    }
    map.stop();
    map.flyTo([item.lat, item.lng], MAP_FOLLOW_ZOOM, { duration: 0.45 });
  }, [activeIndex, itemsKey, map, userPositionRef]);

  return null;
}

function MapEmptyAndUserSync({
  itemsLength,
  userPosition,
}: {
  itemsLength: number;
  userPosition: [number, number] | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (itemsLength !== 0) return;
    if (userPosition) {
      map.setView(userPosition, 14);
    } else {
      map.setView(PHU_QUOC_CENTER, 13);
    }
  }, [itemsLength, userPosition, map]);

  return null;
}

function MapRegisterFlyTo({
  onMapFlyReady,
}: {
  onMapFlyReady?: (flyTo: (p: [number, number]) => void) => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (!onMapFlyReady) return;
    onMapFlyReady((p) => {
      map.flyTo(p, 15, { duration: 0.45 });
    });
  }, [map, onMapFlyReady]);
  return null;
}

/** Убирает блок атрибуции Leaflet/OSM (флаг, ссылка «Leaflet») — тайлы могут снова добавить контрол при layeradd. */
function MapStripLeafletBranding() {
  const map = useMap();
  useEffect(() => {
    const strip = () => {
      const root = map.getContainer();
      root
        .querySelectorAll(".leaflet-control-attribution")
        .forEach((n) => n.remove());
      root
        .querySelectorAll(".leaflet-attribution-flag")
        .forEach((n) => n.remove());
      const ac = map.attributionControl;
      if (ac) {
        try {
          map.removeControl(ac);
        } catch {
          /* уже снят */
        }
      }
    };
    strip();
    map.on("layeradd", strip);
    return () => {
      map.off("layeradd", strip);
    };
  }, [map]);
  return null;
}

/** Синхронизирует опции карты при смене «замка» (react-leaflet не всегда обновляет их с пропсов). */
function MapInteractionLockSync({ interactive }: { interactive: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (interactive) {
      map.dragging.enable();
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
      map.touchZoom.enable();
    } else {
      map.dragging.disable();
      map.scrollWheelZoom.disable();
      map.doubleClickZoom.disable();
      map.touchZoom.disable();
    }
  }, [map, interactive]);
  return null;
}

/** Клик по «пустому» тайлу карты переводит карту в фокус (если режим включён). */
function MapFocusOnBackgroundClick({
  enabled,
  onFocus,
}: {
  enabled: boolean;
  onFocus: () => void;
}) {
  useMapEvents({
    click: () => {
      if (enabled) {
        onFocus();
      }
    },
  });
  return null;
}

const LEAFLET_MARKER_ICON_SELECTOR = ".leaflet-marker-icon";

/** Сброс выбора (например выделенного пина) по клику вне маркеров/кластеров. */
function MapBackgroundDeselectSync({
  onMapBackgroundClick,
}: {
  onMapBackgroundClick?: (() => void) | undefined;
}) {
  const map = useMap();
  const onMapBackgroundClickRef = useRef(onMapBackgroundClick);
  useLayoutEffect(() => {
    onMapBackgroundClickRef.current = onMapBackgroundClick;
  }, [onMapBackgroundClick]);
  useEffect(() => {
    const handler = (e: L.LeafletMouseEvent) => {
      if (onMapBackgroundClickRef.current == null) return;
      const t = e.originalEvent?.target;
      if (!(t instanceof Element)) return;
      if (t.closest(LEAFLET_MARKER_ICON_SELECTOR) != null) return;
      onMapBackgroundClickRef.current();
    };
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [map]);
  return null;
}

export function SearchResultsLeafletMap({
  items,
  selectedIndex,
  onMarkerSelect,
  userLocationAriaLabel,
  userPosition,
  onMapFlyReady,
  interactionGate = false,
  interactionGateHint,
  radiusPickerMode = false,
  radiusMapCenter = PHU_QUOC_CENTER,
  radiusMapInitialZoom = 14,
  radiusPickerMeters = 2000,
  onRadiusSelectionChange,
  onMapBackgroundClick,
}: SearchResultsLeafletMapProps) {
  /**
   * React 19 + Strict Mode: синхронный mount `MapContainer` + `TileLayer` даёт гонку с
   * панелями Leaflet (`appendChild` of undefined) и «Map container is being reused».
   * Монтируем карту после двух rAF; уникальный key на инстанс — без сброса в null в cleanup.
   */
  const [mapInstanceKey, setMapInstanceKey] = useState<string | null>(null);
  useEffect(() => {
    const key = `search-leaflet-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (!cancelled) {
          setMapInstanceKey(key);
        }
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  /** В режиме `interactionGate` стартуем без фокуса — страница скроллится; иначе сразу «в фокусе». */
  const [mapFocused, setMapFocused] = useState(!interactionGate);
  /** Прокрутка над картой без фокуса — кратко показываем подсказку (не перехватывает указатель). */
  const [scrollHintVisible, setScrollHintVisible] = useState(false);

  const mapInteractive = !interactionGate || mapFocused;

  const userPositionRef = useRef<[number, number] | null>(null);
  const onMarkerSelectRef = useRef(onMarkerSelect);
  const radiusPickerModeRef = useRef(radiusPickerMode);
  const interactionGateRef = useRef(interactionGate);
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapFocusedRef = useRef(mapFocused);
  const scrollHintVisibleRef = useRef(scrollHintVisible);

  useLayoutEffect(() => {
    userPositionRef.current = userPosition;
  }, [userPosition]);

  useLayoutEffect(() => {
    onMarkerSelectRef.current = onMarkerSelect;
  }, [onMarkerSelect]);

  useLayoutEffect(() => {
    radiusPickerModeRef.current = radiusPickerMode;
  }, [radiusPickerMode]);

  useLayoutEffect(() => {
    interactionGateRef.current = interactionGate;
  }, [interactionGate]);

  useLayoutEffect(() => {
    mapFocusedRef.current = mapFocused;
    scrollHintVisibleRef.current = scrollHintVisible;
  });

  const clusterMarkerClickByIndex = useMemo(() => {
    const h: Record<number, { click: () => void }> = {};
    for (let index = 0; index < items.length; index++) {
      h[index] = {
        click: () => {
          if (radiusPickerModeRef.current) {
            return;
          }
          if (interactionGateRef.current && !mapFocusedRef.current) {
            setMapFocused(true);
          }
          onMarkerSelectRef.current(index);
        },
      };
    }
    return h;
  }, [items]);

  const focusMap = useCallback(() => {
    setMapFocused(true);
  }, []);

  /** Клик / pointerdown вне карты — снять фокус. */
  useEffect(() => {
    if (!interactionGate || !mapFocused) {
      return;
    }
    const onPointerDownCapture = (e: PointerEvent) => {
      const el = wrapRef.current;
      if (!el?.contains(e.target as Node)) {
        setMapFocused(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDownCapture, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDownCapture, true);
    };
  }, [interactionGate, mapFocused]);

  /** Escape — снять фокус. */
  useEffect(() => {
    if (!interactionGate || !mapFocused) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMapFocused(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [interactionGate, mapFocused]);

  /** Прокрутка колесом над картой без фокуса — показать подсказку. */
  useEffect(() => {
    if (!interactionGate) {
      return;
    }
    const root = wrapRef.current;
    if (!root) {
      return;
    }
    const onWheel = () => {
      if (mapFocusedRef.current || scrollHintVisibleRef.current) {
        return;
      }
      scrollHintVisibleRef.current = true;
      setScrollHintVisible(true);
    };
    root.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      root.removeEventListener("wheel", onWheel);
    };
  }, [interactionGate]);

  useEffect(() => {
    if (!scrollHintVisible) {
      return;
    }
    const id = window.setTimeout(() => {
      scrollHintVisibleRef.current = false;
      setScrollHintVisible(false);
    }, SCROLL_HINT_AUTO_HIDE_MS);
    return () => {
      window.clearTimeout(id);
    };
  }, [scrollHintVisible]);

  const mapFocusOutline = Boolean(interactionGate && mapFocused);
  /** В фокусе жесты должны обрабатывать Leaflet, а не прокручивать страницу. */
  const mapGesturesIsolatePage =
    Boolean(interactionGate && mapFocused);

  const mapCenter = radiusPickerMode ? radiusMapCenter : PHU_QUOC_CENTER;
  const mapZoom = radiusPickerMode ? radiusMapInitialZoom : 13;

  return (
    <div
      ref={wrapRef}
      className={cn(
        "relative size-full min-h-[280px] rounded-2xl [&_.leaflet-bottom.leaflet-right]:!hidden [&_.leaflet-control-attribution]:!hidden [&_img.leaflet-attribution-flag]:!hidden",
        mapGesturesIsolatePage && "touch-none overscroll-contain",
      )}
      onTouchMove={() => {
        if (!interactionGate || mapFocusedRef.current) {
          return;
        }
        if (scrollHintVisibleRef.current) {
          return;
        }
        scrollHintVisibleRef.current = true;
        setScrollHintVisible(true);
      }}
    >
      {mapInstanceKey ? (
        <MapContainer
          key={mapInstanceKey}
          center={mapCenter}
          zoom={mapZoom}
          zoomControl={false}
          attributionControl={false}
          style={{ height: "100%", width: "100%", minHeight: 280 }}
          className={cn(
            "z-0 [&_.leaflet-container]:size-full [&_.leaflet-container]:min-h-[280px]",
            mapGesturesIsolatePage && "touch-none overscroll-contain",
          )}
          dragging={mapInteractive}
          scrollWheelZoom={mapInteractive}
          doubleClickZoom={mapInteractive}
          touchZoom={mapInteractive}
          boxZoom={mapInteractive}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          <MapInteractionLockSync interactive={mapInteractive} />
          <MapFocusOnBackgroundClick
            enabled={Boolean(interactionGate && !mapFocused)}
            onFocus={focusMap}
          />
          <MapBackgroundDeselectSync onMapBackgroundClick={onMapBackgroundClick} />
          <MapStripLeafletBranding />
          {radiusPickerMode ? null : (
            <MapEmptyAndUserSync
              itemsLength={items.length}
              userPosition={userPosition}
            />
          )}
          {radiusPickerMode ? null : (
            <MapViewSync
              items={items}
              selectedIndex={selectedIndex}
              userPositionRef={userPositionRef}
            />
          )}
          <MapRegisterFlyTo onMapFlyReady={onMapFlyReady} />
          {radiusPickerMode && onRadiusSelectionChange ? (
            <MapRadiusMetersOverlay
              mapCenter={radiusMapCenter}
              initialZoom={radiusMapInitialZoom}
              radiusM={radiusPickerMeters}
              onChange={onRadiusSelectionChange}
            />
          ) : null}
          <SearchMapPinsLayer
            items={items}
            selectedIndex={selectedIndex}
            clusterMarkerClickByIndex={clusterMarkerClickByIndex}
            clusterAnimate={!radiusPickerMode}
            userPosition={userPosition}
            userLocationAriaLabel={userLocationAriaLabel}
          />
        </MapContainer>
      ) : (
        <div className="size-full min-h-[280px] bg-muted/20" aria-hidden />
      )}
      {mapFocusOutline ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1000] rounded-2xl border-2 border-secondary"
        />
      ) : null}
      {interactionGate && !mapFocused && scrollHintVisible ? (
        <div
          className="pointer-events-none absolute inset-0 z-[2000] flex flex-col items-center justify-center bg-background/45 px-4 text-center text-sm leading-snug text-foreground shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
        >
          <span className="max-w-[min(100%,18rem)] text-pretty">
            {interactionGateHint ??
              "Tap the map to zoom and pan."}
          </span>
        </div>
      ) : null}
    </div>
  );
}
