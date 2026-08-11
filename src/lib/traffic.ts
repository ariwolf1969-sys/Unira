// Real-time traffic estimates & alternative routes for AMBA (Buenos Aires)
// ─────────────────────────────────────────────────────────────────────
// OSRM doesn't provide live traffic data. This module compensates with:
//   1. Time-of-day speed adjustments based on AMBA traffic patterns
//   2. Alternative route generation via OSRM (different geometries)
//   3. Estimated congestion level visualization

import type { LatLng } from './route';
import type { Place } from './store';

// ─── AMBA Speed Profiles by Hour ────────────────────────────────────
// Based on typical Buenos Aires traffic patterns.
// Speed is in km/h. Index = hour (0-23). Average baseline = 30 km/h.

const AMBA_SPEED_PROFILE: number[] = [
  45, 50, 55, 55, 50, 40, // 0-5: Night/madrugada — fast
  30, 20, 18, 22, 28, 30, // 6-11: Morning rush (7-9 peak)
  30, 28, 25, 22, 18, 20, // 12-17: Afternoon + PM rush (17-18 peak)
  25, 22, 20, 22, 28, 35, // 18-23: Evening wind-down
];

const AMBA_WEEKEND_SPEED: number[] = [
  50, 55, 55, 55, 50, 45, // 0-5: Night — very fast
  35, 32, 30, 30, 30, 32, // 6-11: Calm morning
  32, 30, 30, 28, 28, 30, // 12-17: Afternoon
  32, 30, 28, 25, 30, 40, // 18-23: Evening
];

/**
 * Get the current speed multiplier for AMBA based on time of day.
 * Returns a value like 0.6 (slow) to 1.5 (fast) relative to baseline 30 km/h.
 */
export function getAMBA_SPEED_FACTOR(isWeekend: boolean = false): number {
  const baHour = getCurrentBuenosAiresHour();
  const profile = isWeekend ? AMBA_WEEKEND_SPEED : AMBA_SPEED_PROFILE;
  const currentSpeed = profile[baHour] || 30;
  return currentSpeed / 30; // 30 km/h is baseline
}

function getCurrentBuenosAiresHour(): number {
  try {
    return parseInt(
      new Date().toLocaleString('en-US', {
        timeZone: 'America/Argentina/Buenos_Aires',
        hour: 'numeric',
        hour12: false,
      })
    );
  } catch {
    return new Date().getHours();
  }
}

function getCurrentBuenosAiresDay(): number {
  try {
    return new Date(
      new Date().toLocaleString('en-US', {
        timeZone: 'America/Argentina/Buenos_Aires',
      })
    ).getDay();
  } catch {
    return new Date().getDay();
  }
}

// ─── Congestion level ───────────────────────────────────────────────

export type CongestionLevel = 'low' | 'moderate' | 'high' | 'severe';

export interface TrafficInfo {
  congestionLevel: CongestionLevel;
  speedFactor: number;
  estimatedSpeedKmh: number;
  description: string;
  isRushHour: boolean;
}

/**
 * Get current traffic conditions for AMBA.
 */
export function getCurrentTrafficInfo(): TrafficInfo {
  const day = getCurrentBuenosAiresDay();
  const isWeekend = day === 0 || day === 6;
  const speedFactor = getAMBA_SPEED_FACTOR(isWeekend);
  const estimatedSpeedKmh = 30 * speedFactor;

  let congestionLevel: CongestionLevel;
  let description: string;
  let isRushHour = false;

  if (speedFactor >= 1.3) {
    congestionLevel = 'low';
    description = 'Tráfico fluido';
  } else if (speedFactor >= 1.0) {
    congestionLevel = 'moderate';
    description = 'Tráfico normal';
  } else if (speedFactor >= 0.7) {
    congestionLevel = 'high';
    description = 'Tráfico denso';
    isRushHour = true;
  } else {
    congestionLevel = 'severe';
    description = 'Tráfico muy denso';
    isRushHour = true;
  }

  // Rush hour specifics
  const hour = getCurrentBuenosAiresHour();
  if (!isWeekend && ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19))) {
    description = isWeekend ? description : `${description} (hora pico)`;
    isRushHour = true;
  }

  return { congestionLevel, speedFactor, estimatedSpeedKmh, description, isRushHour };
}

// ─── Congestion colors ─────────────────────────────────────────────

export function getCongestionColor(level: CongestionLevel): string {
  const colors: Record<CongestionLevel, string> = {
    low: '#22C55E',      // green
    moderate: '#F59E0B',  // amber
    high: '#F97316',      // orange
    severe: '#EF4444',    // red
  };
  return colors[level];
}

// ─── Alternative Routes ─────────────────────────────────────────────

export interface AlternativeRoute {
  polyline: LatLng[];
  distanceKm: number;
  durationMin: number;
  /** Summary description of the route */
  summary: string;
  /** Congestion level estimate */
  congestionLevel: CongestionLevel;
  /** Duration in traffic-adjusted minutes */
  durationInTrafficMin: number;
}

/**
 * Fetch up to 3 alternative routes from OSRM.
 * OSRM supports `alternatives=3` to return multiple route options.
 */
export async function fetchAlternativeRoutes(
  origin: Place,
  destination: Place,
  waypoints: Place[] = []
): Promise<AlternativeRoute[]> {
  const allPoints: Place[] = [origin, ...waypoints, destination];
  const osrmCoords = allPoints.map((p) => `${p.lng},${p.lat}`).join(';');

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${osrmCoords}?overview=full&geometries=geojson&alternatives=3&steps=false`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM alternatives ${res.status}`);
    const data = await res.json();

    const routes = data.routes || [];
    if (routes.length === 0) return [];

    const traffic = getCurrentTrafficInfo();
    const results: AlternativeRoute[] = [];

    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      const polyline = route.geometry.coordinates.map(
        ([lng, lat]: [number, number]): LatLng => [lat, lng]
      );
      const distKm = (route.distance || 0) / 1000;
      const durMin = Math.ceil((route.duration || 0) / 60);
      const durInTraffic = Math.ceil(durMin / traffic.speedFactor);

      // Generate a summary label
      let summary: string;
      if (i === 0) {
        summary = 'Ruta recomendada';
      } else if (distKm < (routes[0].distance || 0) / 1000 * 0.95) {
        summary = 'Más corta';
      } else if (durMin < Math.ceil((routes[0].duration || 0) / 60) * 0.9) {
        summary = 'Más rápida';
      } else {
        summary = `Alternativa ${i}`;
      }

      results.push({
        polyline,
        distanceKm: Math.round(distKm * 10) / 10,
        durationMin: durMin,
        summary,
        congestionLevel: traffic.congestionLevel,
        durationInTrafficMin: durInTraffic,
      });
    }

    // Sort by traffic-adjusted duration (fastest first)
    results.sort((a, b) => a.durationInTrafficMin - b.durationInTrafficMin);

    return results;
  } catch (err) {
    console.warn('[traffic] OSRM alternatives failed:', err);
    return [];
  }
}

// ─── Adjust duration with traffic ────────────────────────────────────

/**
 * Adjust an OSRM duration estimate with real-time AMBA traffic conditions.
 */
export function adjustDurationWithTraffic(durationMin: number): number {
  const day = getCurrentBuenosAiresDay();
  const isWeekend = day === 0 || day === 6;
  const speedFactor = getAMBA_SPEED_FACTOR(isWeekend);
  return Math.ceil(durationMin / speedFactor);
}
