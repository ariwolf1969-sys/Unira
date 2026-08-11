// Route generation utilities — Grupo C
// Uses OSRM demo server for real road-following routes, with a dense
// linear interpolation fallback when OSRM is unreachable.

import type { Place } from './store';

export type LatLng = [number, number]; // [lat, lng] — Leaflet convention

/**
 * Route result with polyline and OSRM metadata.
 */
export interface RouteResult {
  /** Array of [lat, lng] tuples forming the route polyline */
  polyline: LatLng[];
  /** Total distance in km (from OSRM or haversine fallback) */
  distanceKm: number;
  /** Estimated duration in minutes (from OSRM or haversine fallback at 25 km/h) */
  durationMin: number;
  /** True when duration comes from OSRM (real traffic-aware estimate) */
  isOsrmDuration: boolean;
}

/**
 * Generate a route polyline between origin → waypoints → destination.
 * Tries OSRM demo server first; falls back to dense linear interpolation.
 *
 * @returns RouteResult with polyline, distance, and duration.
 */
export async function generateRoute(
  origin: Place,
  destination: Place,
  waypoints: Place[] = []
): Promise<RouteResult> {
  // Build the coordinate list in OSRM format: lng,lat;lng,lat;...
  const allPoints: Place[] = [origin, ...waypoints, destination];

  // If origin and destination are essentially the same point, just return them
  if (
    allPoints.every((p) => {
      const dLat = p.lat - origin.lat;
      const dLng = p.lng - origin.lng;
      return Math.sqrt(dLat * dLat + dLng * dLng) < 0.001;
    })
  ) {
    return { polyline: [[origin.lat, origin.lng]], distanceKm: 0, durationMin: 0, isOsrmDuration: false };
  }

  try {
    const osrmCoords = allPoints.map((p) => `${p.lng},${p.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${osrmCoords}?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const data = await res.json();

    if (!data.routes?.[0]?.geometry?.coordinates?.length) {
      throw new Error('OSRM no geometry');
    }

    // OSRM returns [lng, lat] pairs (GeoJSON). Swap to [lat, lng] for Leaflet.
    const polyline = data.routes[0].geometry.coordinates.map(
      ([lng, lat]: [number, number]): LatLng => [lat, lng]
    );

    // Extract real distance and duration from OSRM
    const osrmDistanceKm = (data.routes[0].distance || 0) / 1000; // meters → km
    const osrmDurationMin = (data.routes[0].duration || 0) / 60;   // seconds → minutes

    return {
      polyline,
      distanceKm: osrmDistanceKm,
      durationMin: Math.ceil(osrmDurationMin),
      isOsrmDuration: true,
    };
  } catch (err) {
    console.warn('[route] OSRM failed, using linear interpolation:', err);
    const polyline = generateLinearRoute(allPoints);
    const dist = routeDistance(polyline);
    const avgSpeedKmh = 25;
    const durationMin = Math.ceil((dist / avgSpeedKmh) * 60);
    return { polyline, distanceKm: dist, durationMin, isOsrmDuration: false };
  }
}

/**
 * Legacy convenience wrapper — returns only the polyline.
 * Prefer generateRoute() which returns the full RouteResult.
 */
export async function generateRoutePolyline(
  origin: Place,
  destination: Place,
  waypoints: Place[] = []
): Promise<LatLng[]> {
  const result = await generateRoute(origin, destination, waypoints);
  return result.polyline;
}

/**
 * Dense linear interpolation fallback.
 * Generates 12 intermediate points between each pair of consecutive places,
 * giving a smoothly-curved polyline that follows straight lines between waypoints.
 */
function generateLinearRoute(points: Place[]): LatLng[] {
  const SUBDIVISIONS = 12;
  const result: LatLng[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];

    // Add the start point (skip on the very first iteration to avoid duplicating origin)
    if (i === 0) result.push([a.lat, a.lng]);

    // Interpolate SUBDIVISIONS points between a and b
    for (let j = 1; j <= SUBDIVISIONS; j++) {
      const t = j / (SUBDIVISIONS + 1);
      const lat = a.lat + (b.lat - a.lat) * t;
      const lng = a.lng + (b.lng - a.lng) * t;
      result.push([lat, lng]);
    }

    // Add the end point
    result.push([b.lat, b.lng]);
  }

  return result;
}

/**
 * Compute total route distance (km) from a polyline.
 */
export function routeDistance(route: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    const [lat1, lng1] = route[i - 1];
    const [lat2, lng2] = route[i];
    total += haversineKm(lat1, lng1, lat2, lng2);
  }
  return total;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return haversineKm(lat1, lng1, lat2, lng2);
}

/**
 * Given a polyline of [lat,lng] points and a progress value 0-1,
 * return the interpolated [lat,lng] at that progress along the route.
 * Used by the simulated driver position broadcaster in RideScreen and
 * by the share-page fallback when no live GPS data is available.
 */
export function interpolateAlongRoute(
  route: LatLng[],
  progress: number
): { lat: number; lng: number } | null {
  if (route.length === 0) return null;
  if (route.length === 1) return { lat: route[0][0], lng: route[0][1] };
  if (progress <= 0) return { lat: route[0][0], lng: route[0][1] };
  if (progress >= 1) {
    const last = route[route.length - 1];
    return { lat: last[0], lng: last[1] };
  }

  const segments: { from: LatLng; to: LatLng; length: number }[] = [];
  let totalLength = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const from = route[i];
    const to = route[i + 1];
    const length = haversineKm(from[0], from[1], to[0], to[1]);
    segments.push({ from, to, length });
    totalLength += length;
  }

  if (totalLength === 0) return { lat: route[0][0], lng: route[0][1] };

  let target = progress * totalLength;
  for (const seg of segments) {
    if (target <= seg.length) {
      const t = seg.length === 0 ? 0 : target / seg.length;
      return {
        lat: seg.from[0] + (seg.to[0] - seg.from[0]) * t,
        lng: seg.from[1] + (seg.to[1] - seg.from[1]) * t,
      };
    }
    target -= seg.length;
  }

  const last = route[route.length - 1];
  return { lat: last[0], lng: last[1] };
}

/**
 * Compute the progress (0-1) of a point along a polyline based on its
 * position. The point is snapped to the nearest segment, and progress is
 * calculated as cumulative distance up to the snap point / total distance.
 *
 * Used by GET /api/trips/[id]/location and /api/share/[token] to derive
 * progress from the driver's actual GPS coordinates.
 */
export function computeProgressAlongRoute(
  route: LatLng[],
  point: { lat: number; lng: number }
): number {
  if (route.length === 0) return 0;
  if (route.length === 1) return 0;

  // Build cumulative distances
  const cumulative: number[] = [0];
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    total += haversineKm(route[i - 1][0], route[i - 1][1], route[i][0], route[i][1]);
    cumulative.push(total);
  }
  if (total === 0) return 0;

  // Find nearest segment
  let bestDist = Infinity;
  let bestCumulative = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const segStart = route[i];
    const segEnd = route[i + 1];
    const segLen = cumulative[i + 1] - cumulative[i];
    if (segLen === 0) continue;
    // Project point onto segment (planar approximation — fine for short urban segments)
    const t = projectOnSegment(point, segStart, segEnd);
    const projLat = segStart[0] + (segEnd[0] - segStart[0]) * t;
    const projLng = segStart[1] + (segEnd[1] - segStart[1]) * t;
    const dist = haversineKm(point.lat, point.lng, projLat, projLng);
    if (dist < bestDist) {
      bestDist = dist;
      bestCumulative = cumulative[i] + segLen * t;
    }
  }
  return Math.min(1, Math.max(0, bestCumulative / total));
}

function projectOnSegment(
  p: { lat: number; lng: number },
  a: LatLng,
  b: LatLng
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return 0;
  const t = ((p.lat - a[0]) * dx + (p.lng - a[1]) * dy) / lenSq;
  return Math.min(1, Math.max(0, t));
}

/**
 * Compute ETA in minutes from a current position to a destination.
 * Uses haversine distance and an average urban speed (default 25 km/h,
 * typical for Buenos Aires traffic).
 *
 * Used by GET /api/trips/[id]/location and /api/share/[token] for the
 * dynamic ETA recalculation (Grupo J — J3).
 */
export function computeEtaMin(
  current: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  avgSpeedKmh = 25
): number {
  const distKm = haversineKm(current.lat, current.lng, destination.lat, destination.lng);
  if (avgSpeedKmh <= 0) return 0;
  const hours = distKm / avgSpeedKmh;
  return Math.max(0, Math.ceil(hours * 60));
}

/**
 * Decode a compact polyline string (Google encoded polyline format).
 * Useful if we later switch to an API that returns encoded polylines.
 * Currently unused — kept for future use.
 */
export function decodePolyline(encoded: string): LatLng[] {
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;
  const coords: LatLng[] = [];

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dLat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dLng;

    coords.push([lat / 1e5, lng / 1e5]);
  }
  return coords;
}
