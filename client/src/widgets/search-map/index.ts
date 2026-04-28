/** Leaflet-карта: только динамический импорт из `./ui/search-results-leaflet-map` (не тянуть в SSR). */
export { useUserGeolocation } from "@/shared/lib/use-user-geolocation";
export {
  SearchMapResultCard,
  type SearchMapResultCardProps,
} from "./ui/search-map-result-card";
