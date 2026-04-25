/**
 * Круг на карте для списков каталога (`radiusM` + центр WGS-84).
 * Согласовано с query и `DirectoryRepository`.
 */
export type DirectoryListRadiusFilter = {
  centerLat: number;
  centerLng: number;
  radiusM: number;
};
