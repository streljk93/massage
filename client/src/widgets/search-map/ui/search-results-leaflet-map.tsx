"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import {
  Circle,
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
  selectedIndex: number;
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
  return (
    <>
      <Circle
        center={c}
        radius={radiusM}
        pathOptions={{
          color: "#2563eb",
          fillColor: "#2563eb",
          fillOpacity: 0.12,
          weight: 2,
        }}
      />
      <CircleMarker
        center={c}
        radius={7}
        pathOptions={{
          color: "#ffffff",
          fillColor: "#2563eb",
          fillOpacity: 1,
          weight: 3,
        }}
      />
    </>
  );
}

function escapeAttr(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function createPinIcon(
  selected: boolean,
  imageSrc: string,
  rating: number,
  dimmed = false,
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
  const dimmedStyle = dimmed
    ? "opacity:0.38;filter:grayscale(0.2)"
    : "opacity:1";
  return L.divIcon({
    className: "search-map-pin",
    html: `<div style="display:flex;align-items:center;box-sizing:border-box;gap:${gap}px;width:${totalW}px;height:${totalH}px;padding:${pad}px;background:#fff;border-radius:9999px;box-shadow:${shadow};${dimmedStyle}">
      <div style="width:${avatarSize}px;height:${avatarSize}px;border-radius:50%;overflow:hidden;flex-shrink:0;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.12)">
        <img src="${src}" alt="" width="${avatarSize}" height="${avatarSize}" style="display:block;width:100%;height:100%;object-fit:cover"/>
      </div>
      <span style="font-weight:600;font-size:${fontSize}px;line-height:1;color:#2f2f2f;white-space:nowrap;font-family:system-ui,sans-serif">${ratingText}</span>
    </div>`,
    iconSize: [totalW, totalH],
    iconAnchor: [anchorX, anchorY],
  });
}

function MapViewSync({
  items,
  selectedIndex,
  userPositionRef,
}: {
  items: SearchMapMarkerItem[];
  selectedIndex: number;
  userPositionRef: MutableRefObject<[number, number] | null>;
}) {
  const map = useMap();
  const itemsKey = useMemo(() => items.map((i) => i.id).join("|"), [items]);
  const prevItemsKey = useRef<string | null>(null);
  const safeIndex = Math.min(items.length - 1, Math.max(0, selectedIndex));

  useEffect(() => {
    if (items.length === 0) {
      return;
    }

    const isNewList = prevItemsKey.current !== itemsKey;

    if (isNewList) {
      prevItemsKey.current = itemsKey;
      const bounds = L.latLngBounds(
        items.map((i) => [i.lat, i.lng] as [number, number]),
      );
      const u = userPositionRef.current;
      if (u) {
        bounds.extend(u);
      }
      map.fitBounds(bounds, { padding: [56, 56], maxZoom: 15 });
      return;
    }

    const item = items[safeIndex];
    map.flyTo([item.lat, item.lng], 15, { duration: 0.45 });
  }, [items, itemsKey, map, safeIndex, selectedIndex, userPositionRef]);

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

  const safeIndex = Math.min(items.length - 1, Math.max(0, selectedIndex));
  const userPositionRef = useRef<[number, number] | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapFocusedRef = useRef(mapFocused);
  const scrollHintVisibleRef = useRef(scrollHintVisible);

  useLayoutEffect(() => {
    userPositionRef.current = userPosition;
  }, [userPosition]);

  useLayoutEffect(() => {
    mapFocusedRef.current = mapFocused;
    scrollHintVisibleRef.current = scrollHintVisible;
  });

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
          {items.map((item, index) => (
            <Marker
              key={item.id}
              position={[item.lat, item.lng]}
              zIndexOffset={item.dimmed ? -400 : 0}
              icon={createPinIcon(
                !radiusPickerMode && index === safeIndex,
                item.imageSrc,
                item.rating,
                Boolean(item.dimmed),
              )}
              eventHandlers={{
                click: () => {
                  if (radiusPickerMode) {
                    return;
                  }
                  if (interactionGate && !mapFocused) {
                    setMapFocused(true);
                  }
                  onMarkerSelect(index);
                },
              }}
            />
          ))}
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
