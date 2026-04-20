"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type SearchMapMarkerItem = {
  id: string;
  lat: number;
  lng: number;
  imageSrc: string;
  name: string;
  rating: number;
};

type SearchResultsLeafletMapProps = {
  items: SearchMapMarkerItem[];
  selectedIndex: number;
  onMarkerSelect: (index: number) => void;
};

const PHU_QUOC_CENTER: [number, number] = [10.223, 103.968];

function escapeAttr(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function createPinIcon(
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
    html: `<div style="display:flex;align-items:center;box-sizing:border-box;gap:${gap}px;width:${totalW}px;height:${totalH}px;padding:${pad}px;background:#fff;border-radius:9999px;box-shadow:${shadow}">
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
}: {
  items: SearchMapMarkerItem[];
  selectedIndex: number;
}) {
  const map = useMap();
  const itemsKey = useMemo(() => items.map((i) => i.id).join("|"), [items]);
  const prevItemsKey = useRef<string | null>(null);
  const safeIndex = Math.min(items.length - 1, Math.max(0, selectedIndex));

  useEffect(() => {
    if (items.length === 0) {
      map.setView(PHU_QUOC_CENTER, 13);
      prevItemsKey.current = itemsKey;
      return;
    }

    const isNewList = prevItemsKey.current !== itemsKey;

    if (isNewList) {
      prevItemsKey.current = itemsKey;
      const bounds = L.latLngBounds(
        items.map((i) => [i.lat, i.lng] as [number, number]),
      );
      map.fitBounds(bounds, { padding: [56, 56], maxZoom: 15 });
      return;
    }

    const item = items[safeIndex];
    map.flyTo([item.lat, item.lng], 15, { duration: 0.45 });
  }, [items, itemsKey, map, safeIndex, selectedIndex]);

  return null;
}

export function SearchResultsLeafletMap({
  items,
  selectedIndex,
  onMarkerSelect,
}: SearchResultsLeafletMapProps) {
  const safeIndex = Math.min(items.length - 1, Math.max(0, selectedIndex));

  return (
    <MapContainer
      center={PHU_QUOC_CENTER}
      zoom={13}
      zoomControl={false}
      className="size-full min-h-[280px] z-0 [&_.leaflet-control-attribution]:text-[10px]"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <MapViewSync items={items} selectedIndex={selectedIndex} />
      {items.map((item, index) => (
        <Marker
          key={item.id}
          position={[item.lat, item.lng]}
          icon={createPinIcon(
            index === safeIndex,
            item.imageSrc,
            item.rating,
          )}
          eventHandlers={{
            click: () => {
              onMarkerSelect(index);
            },
          }}
        />
      ))}
    </MapContainer>
  );
}
