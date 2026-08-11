'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Map, NavigationControl, Marker, Popup, LngLatBounds } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DANGEROUS_ZONES } from '@/lib/dangerousZones';

// ── Unira brand colors ──
const TEAL = '#0EA5A0';
const TEAL_DIM = 'rgba(14,165,160,0.35)';
const RED = '#EF4444';
const GREEN = '#22C55E';
const AMBER = '#F59E0B';
const BLUE = '#3B82F6';
const DANGER_RED = '#DC2626';

// Fallback raster style using CARTO (highly reliable, free, no API key)
const CARTO_RASTER_STYLE = {
  version: 8 as const,
  name: 'Unira CARTO',
  sources: {
    carto: {
      type: 'raster' as const,
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    },
  },
  layers: [
    { id: 'carto-layer', type: 'raster' as const, source: 'carto' },
  ],
};

const DEFAULT_CENTER: [number, number] = [-58.3816, -34.6037];
const DEFAULT_ZOOM = 14;

interface MapViewProps {
  origin: { lat: number; lng: number; name: string; address?: string } | null;
  destination: { lat: number; lng: number; name: string; address?: string } | null;
  waypoints?: { lat: number; lng: number; name: string }[] | null;
  onMapClick?: (lat: number, lng: number) => void;
  selectMode?: 'origin' | 'destination' | null;
  userLocation?: { lat: number; lng: number } | null;
  showDangerousZones?: boolean;
}

// ── Helper: create a marker element ──
function createMarkerEl(color: string, size = 20): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `
    width:${size}px;height:${size}px;border-radius:50%;
    background:${color};border:3px solid #fff;
    box-shadow:0 2px 10px rgba(0,0,0,0.3);
    transition: transform 0.15s ease;
  `;
  return el;
}

// ── Helper: create a pulsing user dot ──
function createUserDot(): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `
    width:18px;height:18px;position:relative;
  `;
  el.innerHTML = `
    <div style="width:18px;height:18px;border-radius:50%;background:${BLUE};border:3px solid #fff;box-shadow:0 0 0 4px rgba(59,130,246,0.25), 0 2px 8px rgba(0,0,0,0.2);"></div>
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:36px;height:36px;border-radius:50%;background:rgba(59,130,246,0.15);animation:pulse-ring 2s ease-out infinite;"></div>
  `;
  return el;
}

export default function MapView({ origin, destination, waypoints, onMapClick, selectMode, userLocation, showDangerousZones = true }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const popupRef = useRef<Popup | null>(null);
  const routeSourceId = useRef<string>('route-line');
  const dangerLayerAdded = useRef(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // ── FIX: Use refs to avoid stale closures in event handlers ──
  const selectModeRef = useRef(selectMode);
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => { selectModeRef.current = selectMode; }, [selectMode]);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);

  // ── Initialize map ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center: [number, number] = userLocation ? [userLocation.lng, userLocation.lat] : DEFAULT_CENTER;

    try {
      const map = new Map({
        container: containerRef.current,
        style: CARTO_RASTER_STYLE,
        center,
        zoom: DEFAULT_ZOOM,
        zoomControl: false,
        attributionControl: false,
      });

      // Handle map errors gracefully
      map.on('error', (e) => {
        console.warn('MapLibre error:', e.error);
        // Don't set error state for tile 404s (common with raster tiles)
        const msg = e.error?.message || '';
        if (!msg.includes('404') && !msg.includes('tile')) {
          setMapError('Error cargando el mapa');
        }
      });

      // Zoom control top-right
      map.addControl(new NavigationControl({ showCompass: false }), 'top-right');

      // ── FIX: Click handler reads from refs, not from closure ──
      map.on('click', (e) => {
        const mode = selectModeRef.current;
        const handler = onMapClickRef.current;
        if (mode && handler) {
          handler(e.lngLat.lat, e.lngLat.lng);
        }
      });

      mapRef.current = map;
      setMapError(null);

      // Fix resize issues (SSR/dynamic import)
      const fixSize = () => {
        try { map.resize(); } catch {}
      };
      setTimeout(fixSize, 100);
      setTimeout(fixSize, 300);
      setTimeout(fixSize, 600);
      window.addEventListener('resize', fixSize);

      // Cleanup on unmount
      return () => {
        window.removeEventListener('resize', fixSize);
        try {
          markersRef.current.forEach(m => { try { m.remove(); } catch {} });
        } catch {}
        markersRef.current = [];
        if (userMarkerRef.current) { try { userMarkerRef.current.remove(); } catch {} userMarkerRef.current = null; }
        if (popupRef.current) { try { popupRef.current.remove(); } catch {} popupRef.current = null; }
        try { map.remove(); } catch {}
        mapRef.current = null;
        userLocatedRef.current = false;
      };
    } catch (err) {
      console.error('MapView init error:', err);
      setMapError('No se pudo inicializar el mapa');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Center on user location ONLY ONCE (first arrival) ──
  const userLocatedRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (userLocation && map && !userLocatedRef.current) {
      userLocatedRef.current = true;
      try {
        map.jumpTo({ center: [userLocation.lng, userLocation.lat], zoom: DEFAULT_ZOOM });
      } catch {}
    }
  }, [userLocation]);

  // ── Clear all custom markers ──
  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(m => { try { m.remove(); } catch {} });
    markersRef.current = [];
    if (popupRef.current) { try { popupRef.current.remove(); } catch {} popupRef.current = null; }
  }, []);

  // ── Draw origin, destination, waypoints, route line ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const draw = () => {
      try {
        // Clear route markers
        markersRef.current = markersRef.current.filter(m => {
          try { m.remove(); } catch {}
          return false;
        });

        // Remove old route layer and source
        const rid = routeSourceId.current;
        try { if (map.getLayer('route-fill')) map.removeLayer('route-fill'); } catch {}
        try { if (map.getLayer('route-line')) map.removeLayer('route-line'); } catch {}
        try { if (map.getSource(rid)) map.removeSource(rid); } catch {}

        const coords: [number, number][] = [];

        // Origin marker (green)
        if (origin && isFinite(origin.lat) && isFinite(origin.lng)) {
          const marker = new Marker({ element: createMarkerEl(GREEN, 16) })
            .setLngLat([origin.lng, origin.lat])
            .addTo(map);
          markersRef.current.push(marker);
          coords.push([origin.lng, origin.lat]);
        }

        // Waypoints (amber)
        if (waypoints) {
          waypoints.forEach((wp) => {
            if (isFinite(wp.lat) && isFinite(wp.lng)) {
              const marker = new Marker({ element: createMarkerEl(AMBER, 14) })
                .setLngLat([wp.lng, wp.lat])
                .addTo(map);
              markersRef.current.push(marker);
              coords.push([wp.lng, wp.lat]);
            }
          });
        }

        // Destination marker (red)
        if (destination && isFinite(destination.lat) && isFinite(destination.lng)) {
          const marker = new Marker({ element: createMarkerEl(RED, 16) })
            .setLngLat([destination.lng, destination.lat])
            .addTo(map);
          markersRef.current.push(marker);
          coords.push([destination.lng, destination.lat]);
        }

        // Draw route line through all points
        if (coords.length >= 2) {
          map.addSource(rid, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: coords },
            },
          });
          map.addLayer({
            id: 'route-fill',
            type: 'line',
            source: rid,
            paint: {
              'line-color': TEAL_DIM,
              'line-width': 10,
              'line-cap': 'round',
              'line-joint': 'round',
            },
          });
          map.addLayer({
            id: 'route-line',
            type: 'line',
            source: rid,
            paint: {
              'line-color': TEAL,
              'line-width': 4,
              'line-dasharray': [2, 4],
              'line-cap': 'round',
              'line-joint': 'round',
            },
          });
        }

        // Fit bounds ONLY when we have origin+destination (not on every redraw)
        if (origin && destination && isFinite(origin.lat) && isFinite(destination.lat)) {
          const bounds = new LngLatBounds();
          coords.forEach(c => bounds.extend(c));
          map.fitBounds(bounds, { padding: { top: 60, bottom: 60, left: 60, right: 60 }, maxZoom: 16 });
        }
      } catch (err) {
        console.error('MapView draw error:', err);
      }
    };

    if (map.isStyleLoaded()) {
      draw();
    } else {
      map.once('load', draw);
    }
  }, [origin, destination, waypoints, clearMarkers]);

  // ── Update user location marker (separate effect) ──
  const userMarkerRef = useRef<Marker | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation || !isFinite(userLocation.lat) || !isFinite(userLocation.lng)) return;

    const setUserMarker = () => {
      try {
        if (userMarkerRef.current) {
          userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
        } else {
          userMarkerRef.current = new Marker({ element: createUserDot() })
            .setLngLat([userLocation.lng, userLocation.lat])
            .addTo(map);
        }
      } catch (err) {
        console.error('User marker error:', err);
      }
    };

    // For raster tiles, try immediately first; fall back to 'load' event
    // if style is not yet ready (first load)
    try {
      setUserMarker();
    } catch {
      // If map not ready, wait for load
      map.once('load', setUserMarker);
    }
  }, [userLocation]);

  // ── Dangerous zone overlays ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showDangerousZones) return;

    const draw = () => {
      try {
        DANGEROUS_ZONES.forEach((z) => {
          const dzId = `danger-zone-${z.lat}-${z.lng}`;
          if (map.getSource(dzId)) return;

          map.addSource(dzId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: { name: z.name, note: z.note },
              geometry: {
                type: 'Point',
                coordinates: [z.lng, z.lat],
              },
            },
          });

          try { if (map.getLayer(`${dzId}-circle`)) map.removeLayer(`${dzId}-circle`); } catch {}

          map.addLayer({
            id: `${dzId}-circle`,
            type: 'circle',
            source: dzId,
            paint: {
              'circle-radius': z.radiusM / (Math.cos(z.lat * Math.PI / 180) * 111320) * (Math.pow(2, map.getZoom()) * 156543.03392 / 360 / 1),
              'circle-color': DANGER_RED,
              'circle-opacity': 0.08,
              'circle-stroke-width': 1,
              'circle-stroke-color': DANGER_RED,
              'circle-stroke-opacity': 0.25,
            },
          });

          const warningEl = document.createElement('div');
          warningEl.style.cssText = `
            display:flex;align-items:center;justify-content:center;
            width:32px;height:32px;border-radius:50%;
            background:${DANGER_RED};border:2px solid #fff;
            box-shadow:0 2px 10px rgba(0,0,0,0.35);cursor:pointer;
          `;
          warningEl.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

          const marker = new Marker({ element: warningEl })
            .setLngLat([z.lng, z.lat])
            .setPopup(
              new Popup({ offset: 16, className: 'unira-danger-popup', closeButton: false })
                .setHTML(`<div style="font-weight:700;color:${DANGER_RED};font-size:13px;">⚠ ${z.name}</div><div style="margin-top:4px;font-size:11px;color:#6B7280;max-width:180px;">${z.note}</div>`)
            )
            .addTo(map);
          markersRef.current.push(marker);
        });
      } catch (err) {
        console.error('Dangerous zones draw error:', err);
      }
    };

    if (map.isStyleLoaded()) {
      draw();
    } else {
      map.once('load', draw);
    }
  }, [showDangerousZones]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Selection mode cursor ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    (container as HTMLDivElement).style.cursor = selectMode ? 'crosshair' : '';
  }, [selectMode]);

  if (mapError) {
    return (
      <div className="w-full h-full rounded-2xl bg-gray-100 flex items-center justify-center">
        <p className="text-sm text-gray-500">{mapError}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full rounded-2xl" style={{ zIndex: 0 }} />

      {/* Selection mode banner */}
      {selectMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-gray-900/90 backdrop-blur-md text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg">
          Tocá el mapa para marcar {selectMode === 'origin' ? 'el punto de partida' : 'el destino'}
          <span className="ml-1 text-gray-300">|</span>
          <span className="ml-1 text-gray-300">Deslizá para moverte</span>
        </div>
      )}

      <style>{`
        .maplibregl-ctrl-top-right { top: 12px; }
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
        .maplibregl-ctrl-group button span { background-size: 16px 16px !important; }
        .unira-danger-popup .maplibregl-popup-content {
          background: #fff !important;
          color: #7F1D1D !important;
          border-radius: 12px !important;
          padding: 10px 14px !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.15) !important;
          border: 1px solid #FECACA !important;
        }
        .unira-danger-popup .maplibregl-popup-tip { border-top-color: #FECACA !important; }
        @keyframes pulse-ring {
          0% { transform: translate(-50%,-50%) scale(0.5); opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
