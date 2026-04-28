"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { ADDRESS_MAP_TILE_URL } from "../lib/address-map-tiles";

export function createAddressPickPinIcon() {
  return L.divIcon({
    className: "address-map-picker-pin",
    html: '<div style="width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.22)"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function MapClickLayer({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapInvalidateOnReady() {
  const map = useMap();
  useEffect(() => {
    const run = () => {
      map.invalidateSize({ animate: false });
    };
    run();
    const t1 = window.setTimeout(run, 120);
    const t2 = window.setTimeout(run, 320);
    const t3 = window.setTimeout(run, 600);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [map]);
  return null;
}

/**
 * При увеличении `mapFlySeq` карта подлетает к `(lat, lng)` (например после выбора из поиска).
 * Не вызывается при перетаскивании пина — только при явном инкременте seq с родителя.
 */
function MapFlyToSeq({
  flySeq,
  lat,
  lng,
  zoom,
}: {
  flySeq: number;
  lat: number;
  lng: number;
  zoom: number;
}) {
  const map = useMap();
  const prevSeq = useRef<number | null>(null);
  useEffect(() => {
    if (flySeq < 1) {
      return;
    }
    if (prevSeq.current === flySeq) {
      return;
    }
    prevSeq.current = flySeq;
    map.flyTo([lat, lng], zoom, { duration: 0.4 });
  }, [flySeq, lat, lng, map, zoom]);
  return null;
}

function MapRegisterFlyTo({
  flyZoom,
  onMapFlyReady,
}: {
  flyZoom: number;
  onMapFlyReady?: (flyTo: (p: [number, number]) => void) => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (!onMapFlyReady) return;
    onMapFlyReady((p) => {
      map.flyTo(p, flyZoom, { duration: 0.4 });
    });
  }, [flyZoom, map, onMapFlyReady]);
  return null;
}

export type AddressMapPickerLeafletProps = {
  mapInstanceKey: string;
  /** Стартовый центр контейнера карты. */
  defaultCenter: [number, number];
  initialZoom: number;
  marker: [number, number];
  onPositionChange: (lat: number, lng: number) => void;
  /** Увеличить на 1 при успешном resolve подсказки — запускает fly к маркеру. */
  mapFlySeq: number;
  flyToZoom?: number;
  /** Родитель получает `flyTo(latLng)` для программного подлёта (например геолокация). */
  onMapFlyReady?: (flyTo: (p: [number, number]) => void) => void;
  className?: string;
  mapMinHeight?: string;
};

export function AddressMapPickerLeaflet({
  mapInstanceKey,
  defaultCenter,
  initialZoom,
  marker,
  onPositionChange,
  mapFlySeq,
  flyToZoom = 16,
  onMapFlyReady,
  className,
  mapMinHeight = "min(52vh, 420px)",
}: AddressMapPickerLeafletProps) {
  const icon = useMemo(() => createAddressPickPinIcon(), []);
  const [m0, m1] = marker;

  return (
    <MapContainer
      key={mapInstanceKey}
      center={defaultCenter}
      zoom={initialZoom}
      zoomControl
      attributionControl={false}
      className={className}
      style={{ height: mapMinHeight, width: "100%" }}
    >
      <TileLayer url={ADDRESS_MAP_TILE_URL} />
      <MapInvalidateOnReady />
      <MapRegisterFlyTo flyZoom={flyToZoom} onMapFlyReady={onMapFlyReady} />
      <MapFlyToSeq flySeq={mapFlySeq} lat={m0} lng={m1} zoom={flyToZoom} />
      <MapClickLayer onPick={onPositionChange} />
      <Marker
        position={marker}
        icon={icon}
        draggable
        eventHandlers={{
          dragend: (e) => {
            const ll = e.target.getLatLng();
            onPositionChange(ll.lat, ll.lng);
          },
        }}
      />
    </MapContainer>
  );
}
