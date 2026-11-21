export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface SpatialBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export const COIMBATORE_BOUNDS: SpatialBounds = {
  minLat: 10.975,
  maxLat: 11.045,
  minLng: 76.925,
  maxLng: 77.025,
};

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

export function computeSpatialBounds(points: GeoPoint[]): SpatialBounds | null {
  if (points.length === 0) return null;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    minLat,
    maxLat: maxLat === minLat ? minLat + 0.01 : maxLat,
    minLng,
    maxLng: maxLng === minLng ? minLng + 0.01 : maxLng,
  };
}

export function projectToSpatialGrid(
  lat: number,
  lng: number,
  bounds: SpatialBounds = COIMBATORE_BOUNDS,
  padding: { x?: number; y?: number } = {}
): { x: number; y: number } {
  const padX = padding.x ?? 8;
  const padY = padding.y ?? 10;
  const spanLng = bounds.maxLng - bounds.minLng || 0.01;
  const spanLat = bounds.maxLat - bounds.minLat || 0.01;
  const normX = (lng - bounds.minLng) / spanLng;
  const normY = 1 - (lat - bounds.minLat) / spanLat;

  return {
    x: Math.max(padX, Math.min(100 - padX, padX + normX * (100 - 2 * padX))),
    y: Math.max(padY, Math.min(100 - padY, padY + normY * (100 - 2 * padY))),
  };
}
