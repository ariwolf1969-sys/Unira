'use client';

import { useEffect, useRef } from 'react';
import { Map, NavigationControl, Marker, Popup, LngLatBounds } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { LatLng } from '@/lib/route';

// ── Unira style (same base as MapView) ──
const TEAL = '#0EA5A0';
const TEAL_BLUE = '#0C8CE9';
const RED = '#EF4444';
const GREEN = '#22C55E';
const AMBER = '#F59E0B';

// CARTO raster style — highly reliable, free, no API key
const CARTO_RASTER_STYLE = {
  version: 8 as const,
  name: 'Unira Trip',
  sources: {
    carto: {
      type: 'raster' as const,
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
    },
  },
  layers: [
    { id: 'carto-layer', type: 'raster' as const, source: 'carto' },
  ],
};

interface TripLiveMapProps {
  route: LatLng[] | null;
  progress: number;
  heading?: number;
  origin: { lat: number; lng: number; name: string; address?: string } | null;
  destination: { lat: number; lng: number; name: string; address?: string } | null;
  waypoints?: { lat: number; lng: number; name: string }[];
  eta?: number;
  distanceKm?: number;
  isLive?: boolean;
  showDangerousZones?: boolean;
  navigationInstruction?: string | null;
  nextInstruction?: string | null;
  distanceToManeuver?: number;
}

// ── Compute heading from route polyline ──
function computeHeadingFromRoute(route: LatLng[], progress: number): number {
  if (route.length < 2) return 0;
  const idx = Math.min(
    Math.floor((progress / 100) * (route.length - 1)),
    route.length - 2
  );
  const [lat1, lng1] = route[idx];
  const [lat2, lng2] = route[idx + 1];
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(lat1), φ2 = toRad(lat2), Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// ── Interpolate position along route ──
function getPositionOnRoute(route: LatLng[], progress: number): { lat: number; lng: number } | null {
  if (route.length === 0) return null;
  if (route.length === 1) return { lat: route[0][0], lng: route[0][1] };
  const p = Math.max(0, Math.min(1, progress / 100));
  const cumulative: number[] = [0];
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    const [lat1, lng1] = route[i - 1], [lat2, lng2] = route[i];
    total += Math.sqrt((lat2 - lat1) ** 2 + (lng2 - lng1) ** 2);
    cumulative.push(total);
  }
  if (total === 0) return { lat: route[0][0], lng: route[0][1] };
  const target = p * total;
  for (let i = 1; i < route.length; i++) {
    if (target <= cumulative[i]) {
      const segLen = cumulative[i] - cumulative[i - 1];
      const t = segLen === 0 ? 0 : (target - cumulative[i - 1]) / segLen;
      return {
        lat: route[i - 1][0] + (route[i][0] - route[i - 1][0]) * t,
        lng: route[i - 1][1] + (route[i][1] - route[i - 1][1]) * t,
      };
    }
  }
  const last = route[route.length - 1];
  return { lat: last[0], lng: last[1] };
}

// ── Get traveled portion coordinates ──
function getTraveledCoords(route: LatLng[], progress: number): [number, number][] {
  if (route.length === 0 || progress <= 0) return [];
  const pos = getPositionOnRoute(route, progress);
  if (!pos) return [];
  const result: [number, number][] = [];
  for (const [lat, lng] of route) {
    result.push([lng, lat]);
    if (Math.abs(lat - pos.lat) < 0.0001 && Math.abs(lng - pos.lng) < 0.0001) break;
  }
  return result;
}

// ── Create car icon element ──
function createCarElement(heading: number): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = 'width:40px;height:40px;display:flex;align-items:center;justify-content:center;';
  el.innerHTML = `
    <div style="transform:rotate(${heading}deg);filter:drop-shadow(0 3px 6px rgba(0,0,0,0.35));">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="${TEAL}" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18 10l-2.7-3.6C15 5.5 14.3 5 13.6 5H8.4c-.7 0-1.4.5-1.7 1.1L4 10l-2.5 1.1C.7 11.3 0 12.1 0 13v3c0 .6.4 1 1 1h2"/>
        <circle cx="7" cy="17" r="2" fill="white" stroke="${TEAL}" stroke-width="1.5"/>
        <circle cx="17" cy="17" r="2" fill="white" stroke="${TEAL}" stroke-width="1.5"/>
        <line x1="5" y1="10" x2="19" y2="10" stroke="white" stroke-width="1.5"/>
      </svg>
    </div>
  `;
  return el;
}

// ── Create marker element ──
function createMarkerEl(color: string, size = 16): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.3);`;
  return el;
}

export default function TripLiveMap({
  route,
  progress,
  heading: propHeading,
  origin,
  destination,
  waypoints = [],
  eta,
  distanceKm,
  isLive = false,
  navigationInstruction,
  nextInstruction,
  distanceToManeuver,
}: TripLiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const carMarkerRef = useRef<Marker | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const routeDrawn = useRef(false);

  // ── Initialize map ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center = origin
      ? [origin.lng, origin.lat]
      : [-58.3816, -34.6037];

    const map = new Map({
      container: containerRef.current,
      style: CARTO_RASTER_STYLE,
      center: center as any,
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
    } as any);

    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right' as any);

    mapRef.current = map;

    const fixSize = () => map.resize();
    setTimeout(fixSize, 100);
    setTimeout(fixSize, 300);
    setTimeout(fixSize, 600);
    window.addEventListener('resize', fixSize);

    return () => {
      window.removeEventListener('resize', fixSize);
      if (carMarkerRef.current) { carMarkerRef.current.remove(); carMarkerRef.current = null; }
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
      routeDrawn.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Draw route polyline + markers ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !route || route.length < 2) return;

    const draw = () => {
      // Clear previous markers
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      // Remove old route layers
      ['route-outline', 'route-main', 'route-traveled'].forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      if (map.getSource('trip-route')) map.removeSource('trip-route');

      const routeCoords: [number, number][] = route.map(([lat, lng]) => [lng, lat]);

      // Route source
      map.addSource('trip-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: routeCoords },
        },
      });

      // Route outline
      map.addLayer({
        id: 'route-outline',
        type: 'line',
        source: 'trip-route',
        paint: {
          'line-color': TEAL,
          'line-width': 8,
          'line-opacity': 0.3,
          'line-cap': 'round',
          'line-join': 'round',
        },
      } as any);

      // Main route line
      map.addLayer({
        id: 'route-main',
        type: 'line',
        source: 'trip-route',
        paint: {
          'line-color': TEAL,
          'line-width': 5,
          'line-opacity': 0.85,
          'line-cap': 'round',
          'line-join': 'round',
        },
      } as any);

      // Traveled portion (blue overlay)
      const traveledCoords = getTraveledCoords(route, progress);
      if (traveledCoords.length >= 2) {
        if (map.getSource('trip-traveled')) map.removeSource('trip-traveled');
        if (map.getLayer('route-traveled')) map.removeLayer('route-traveled');

        map.addSource('trip-traveled', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: traveledCoords },
          },
        });
        map.addLayer({
          id: 'route-traveled',
          type: 'line',
          source: 'trip-traveled',
          paint: {
            'line-color': TEAL_BLUE,
            'line-width': 5,
            'line-opacity': 0.9,
            'line-cap': 'round',
            'line-join': 'round',
          },
        } as any);
      }

      // Origin marker
      if (origin) {
        const m = new Marker({ element: createMarkerEl(GREEN, 18) })
          .setLngLat([origin.lng, origin.lat])
          .setPopup(new Popup({ offset: 14, closeButton: false, className: 'trip-popup' })
            .setHTML(`<span style="font-weight:600;font-size:12px;">🟢 ${origin.name}</span>`))
          .addTo(map);
        markersRef.current.push(m);
      }

      // Destination marker
      if (destination) {
        const m = new Marker({ element: createMarkerEl(RED, 18) })
          .setLngLat([destination.lng, destination.lat])
          .setPopup(new Popup({ offset: 14, closeButton: false, className: 'trip-popup' })
            .setHTML(`<span style="font-weight:600;font-size:12px;">🔴 ${destination.name}</span>`))
          .addTo(map);
        markersRef.current.push(m);
      }

      // Waypoint markers
      waypoints.forEach((wp, i) => {
        const m = new Marker({ element: createMarkerEl(AMBER, 14) })
          .setLngLat([wp.lng, wp.lat])
          .addTo(map);
        markersRef.current.push(m);
      });

      // Fit bounds
      const bounds = new LngLatBounds();
      routeCoords.forEach(c => bounds.extend(c));
      if (bounds.getNorthEast() && bounds.getSouthWest()) {
        map.fitBounds(bounds, { padding: { top: 80, bottom: 120, left: 50, right: 50 }, maxZoom: 16 });
      }

      routeDrawn.current = true;
    };

    if (map.isStyleLoaded()) {
      draw();
    } else {
      map.once('load', draw);
    }
  }, [route, origin, destination, waypoints, progress]);

  // ── Update car position ──
  useEffect(() => {
    if (!route || route.length < 2 || !routeDrawn.current) return;

    const map = mapRef.current;
    if (!map) return;

    const pos = getPositionOnRoute(route, progress);
    if (!pos) return;

    const h = propHeading ?? computeHeadingFromRoute(route, progress);

    if (carMarkerRef.current) {
      carMarkerRef.current.setLngLat([pos.lng, pos.lat]);
      // Update the car icon rotation
      const el = carMarkerRef.current.getElement();
      if (el) {
        const inner = el.querySelector('div > div') as HTMLElement;
        if (inner) inner.style.transform = `rotate(${h}deg)`;
      }
    } else {
      carMarkerRef.current = new Marker({
        element: createCarElement(h),
        anchor: 'center',
      })
        .setLngLat([pos.lng, pos.lat])
        .addTo(map);
    }

    // Pan to follow car
    if (progress > 0 && progress < 100) {
      map.easeTo({ center: [pos.lng, pos.lat], duration: 800 });
    }
  }, [route, progress, propHeading]);

  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full" style={{ zIndex: 0 }} />

      {/* Navigation instruction banner */}
      {navigationInstruction && (
        <div className="absolute top-14 left-3 right-3 z-10 pointer-events-none">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl px-4 py-3 shadow-lg border border-gray-100 pointer-events-auto">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0EA5A0]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0EA5A0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 10 20 15 15 20" />
                  <path d="M4 4v7a4 4 0 0 0 4 4h12" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 leading-snug">{navigationInstruction}</p>
                {distanceToManeuver !== undefined && distanceToManeuver > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0EA5A0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="3 11 22 2 13 21 11 13 3 11" />
                    </svg>
                    <span className="text-xs font-medium text-[#0EA5A0]">
                      {distanceToManeuver < 1000
                        ? `${Math.round(distanceToManeuver)} m`
                        : `${(distanceToManeuver / 1000).toFixed(1)} km`}
                    </span>
                  </div>
                )}
                {nextInstruction && (
                  <p className="text-[10px] text-gray-400 mt-1 truncate">Después: {nextInstruction}</p>
                )}
              </div>
              <button className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0" aria-label="Voz activada">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top HUD overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
        <div className="bg-gradient-to-b from-black/60 to-transparent px-4 pt-3 pb-6">
          <div className="flex items-center justify-between">
            <div className="pointer-events-auto">
              {isLive ? (
                <div className="flex items-center gap-1.5 bg-emerald-500/90 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                  </span>
                  <span className="text-[11px] font-bold text-white tracking-wide">EN VIVO</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-gray-500/80 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <span className="text-[11px] font-bold text-white tracking-wide">Simulado</span>
                </div>
              )}
            </div>
            <div className="text-right">
              {eta !== undefined && (
                <div className="text-2xl font-bold text-white tabular-nums">{Math.ceil(eta)}<span className="text-sm font-normal ml-0.5">min</span></div>
              )}
              {distanceKm !== undefined && (
                <div className="text-[11px] text-white/70">{distanceKm.toFixed(1)} km</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom destination bar */}
      {destination && (
        <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
          <div className="bg-gradient-to-t from-black/60 to-transparent px-4 pt-8 pb-3">
            <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-xl px-3 py-2.5 shadow-lg pointer-events-auto">
              <div className="w-3 h-3 rounded-full bg-red-500 ring-2 ring-red-200 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-900 truncate">{destination.name}</p>
                <p className="text-[10px] text-gray-500 truncate">{destination.address || 'Destino'}</p>
              </div>
              {progress > 0 && (
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-[#0EA5A0] flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">{Math.round(progress)}%</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .trip-popup .maplibregl-popup-content {
          background: #1F2937 !important;
          color: #F9FAFB !important;
          border-radius: 10px !important;
          padding: 6px 12px !important;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2) !important;
          border: none !important;
        }
        .trip-popup .maplibregl-popup-tip { border-top-color: #1F2937 !important; }
        .maplibregl-ctrl-bottom-right { bottom: 80px !important; }
        .maplibregl-ctrl-group {
          border-radius: 12px !important;
          border: none !important;
          box-shadow: 0 2px 10px rgba(0,0,0,0.12) !important;
          overflow: hidden;
        }
        .maplibregl-ctrl-group button {
          width: 36px !important;
          height: 36px !important;
          border: none !important;
          background: #fff !important;
        }
        .maplibregl-ctrl-group button:hover { background: #f3f4f6 !important; }
      `}</style>
    </div>
  );
}
