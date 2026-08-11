'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useRadarAlerts — Grupo M
 *
 * Polls /api/pois/radares once on mount (caches on server for 24h), then
 * watches the user's geolocation. When the user gets within `alertRadiusM`
 * of any radar, fires an alert callback. Once the user moves out of range,
 * the alert clears (so it can re-fire on the next approach).
 *
 * Also exposes maxspeed info from the nearest road (via Overpass reverse
 * lookup is overkill — instead we return the maxspeed of the nearest radar,
 * which usually matches the road's limit).
 */

export interface RadarPoint {
  id: string;
  lat: number;
  lng: number;
  type: string;        // 'fixed' | 'mobile'
  maxspeed?: number;
  street?: string;
}

export interface RadarAlert {
  radar: RadarPoint;
  distanceM: number;        // meters to the radar
  bearing: number;          // 0-359 degrees, from user to radar
  ahead: boolean;           // is the radar in front of the user? (based on heading)
}

interface UseRadarAlertsOptions {
  enabled: boolean;
  alertRadiusM?: number;     // default 300
  /** Called when entering alert range. */
  onAlert?: (alert: RadarAlert) => void;
}

export function useRadarAlerts({
  enabled,
  alertRadiusM = 300,
  onAlert,
}: UseRadarAlertsOptions) {
  const [radares, setRadares] = useState<RadarPoint[]>([]);
  const [activeAlert, setActiveAlert] = useState<RadarAlert | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'overpass' | 'cache' | 'static' | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastPosRef = useRef<{ lat: number; lng: number; heading: number } | null>(null);
  const lastAlertedIdRef = useRef<string | null>(null);
  const onAlertRef = useRef(onAlert);
  onAlertRef.current = onAlert;

  // Fetch radars once on mount
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/pois/radares');
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setRadares(json.radares);
        setSource(json.source);
      } catch (err) {
        console.warn('[useRadarAlerts] fetch failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  // Watch position
  useEffect(() => {
    if (!enabled || !navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, heading } = pos.coords;
        const userHeading = heading != null && !isNaN(heading) ? heading : 0;
        lastPosRef.current = { lat: latitude, lng: longitude, heading: userHeading };

        // Find nearest radar within radius
        let nearest: RadarAlert | null = null;
        for (const radar of radares) {
          const distanceM = haversineMeters(latitude, longitude, radar.lat, radar.lng);
          if (distanceM > alertRadiusM) continue;

          const bearing = computeBearing(latitude, longitude, radar.lat, radar.lng);
          const angleDiff = angleDifference(userHeading, bearing);
          const ahead = angleDiff < 90;  // within 90° of forward direction

          if (!nearest || distanceM < nearest.distanceM) {
            nearest = { radar, distanceM, bearing, ahead };
          }
        }

        if (nearest) {
          // Only fire onAlert if this is a NEW radar (not the same one we alerted last tick)
          if (lastAlertedIdRef.current !== nearest.radar.id) {
            lastAlertedIdRef.current = nearest.radar.id;
            onAlertRef.current?.(nearest);
          }
          setActiveAlert(nearest);
        } else {
          // Cleared — allow re-alert if we approach again
          lastAlertedIdRef.current = null;
          setActiveAlert(null);
        }
      },
      (err) => {
        // Silent — geolocation errors are common (permission denied, etc.)
        console.warn('[useRadarAlerts] geolocation error:', err.message);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, radares, alertRadiusM]);

  return { radares, activeAlert, loading, source };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function angleDifference(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}
