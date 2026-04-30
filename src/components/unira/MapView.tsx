'use client';

import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Default: Buenos Aires center
const DEFAULT_CENTER: [number, number] = [-34.6037, -58.3816];
const DEFAULT_ZOOM = 14;

interface MapViewProps {
  origin: { lat: number; lng: number; name: string } | null;
  destination: { lat: number; lng: number; name: string } | null;
  waypoints?: { lat: number; lng: number; name: string }[] | null;
  onMapClick?: (lat: number, lng: number) => void;
  selectMode?: 'origin' | 'destination' | null;
  userLocation?: { lat: number; lng: number } | null;
}

export default function MapView({ origin, destination, waypoints, onMapClick, selectMode, userLocation }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const clickMarkerRef = useRef<L.Marker | null>(null);

  // Initialize map with user location or default
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialCenter = userLocation ? [userLocation.lat, userLocation.lng] as [number, number] : DEFAULT_CENTER;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView(initialCenter, DEFAULT_ZOOM);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    // Zoom control on the right
    L.control.zoom({ position: 'topright' }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);

    // Map click handler
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (selectMode && onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    });

    mapRef.current = map;

    const fixSize = () => {
      if (mapRef.current) mapRef.current.invalidateSize();
    };
    setTimeout(fixSize, 100);
    setTimeout(fixSize, 300);
    setTimeout(fixSize, 600);
    window.addEventListener('resize', fixSize);

    return () => {
      window.removeEventListener('resize', fixSize);
      if (clickMarkerRef.current) {
        clickMarkerRef.current.remove();
        clickMarkerRef.current = null;
      }
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update view when user location changes (after map init)
  useEffect(() => {
    if (userLocation && mapRef.current) {
      mapRef.current.setView([userLocation.lat, userLocation.lng], DEFAULT_ZOOM);
    }
  }, [userLocation]);

  // Custom marker icon for selection mode
  const getSelectMarker = useCallback((): L.DivIcon => {
    const color = selectMode === 'origin' ? '#22C55E' : selectMode === 'destination' ? '#EF4444' : '#0EA5A0';
    return L.divIcon({
      className: '',
      html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }, [selectMode]);

  // Draw origin, destination, waypoints, and route
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const bounds: L.LatLngBounds = L.latLngBounds([]);

    // User location marker (blue pulsing dot)
    if (userLocation) {
      const userDot = L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 10,
        fillColor: '#3B82F6',
        fillOpacity: 1,
        color: '#fff',
        weight: 3,
      });
      userDot.addTo(layer);
      // Accuracy circle
      L.circle([userLocation.lat, userLocation.lng], {
        radius: 80,
        fillColor: '#3B82F6',
        fillOpacity: 0.08,
        color: '#3B82F6',
        weight: 1,
        opacity: 0.2,
      }).addTo(layer);
      bounds.extend([userLocation.lat, userLocation.lng]);
    }

    // Origin marker
    if (origin) {
      const m = L.circleMarker([origin.lat, origin.lng], {
        radius: 8,
        fillColor: '#22C55E',
        fillOpacity: 1,
        color: '#fff',
        weight: 3,
      });
      m.addTo(layer);
      if (origin.name) {
        m.bindTooltip(origin.name, { direction: 'top', offset: [0, -10], className: 'unira-tooltip' });
      }
      bounds.extend([origin.lat, origin.lng]);
    }

    // Waypoints
    const allPoints: Array<{ lat: number; lng: number }> = [];
    if (origin) allPoints.push(origin);
    if (waypoints) {
      waypoints.forEach((wp, i) => {
        const wpMarker = L.circleMarker([wp.lat, wp.lng], {
          radius: 7,
          fillColor: '#F59E0B',
          fillOpacity: 1,
          color: '#fff',
          weight: 2,
        });
        wpMarker.addTo(layer);
        if (wp.name) {
          wpMarker.bindTooltip(`${i + 1}. ${wp.name}`, { direction: 'top', offset: [0, -10], className: 'unira-tooltip' });
        }
        allPoints.push(wp);
        bounds.extend([wp.lat, wp.lng]);
      });
    }
    if (destination) allPoints.push(destination);

    // Destination marker
    if (destination) {
      const m = L.circleMarker([destination.lat, destination.lng], {
        radius: 8,
        fillColor: '#EF4444',
        fillOpacity: 1,
        color: '#fff',
        weight: 3,
      });
      m.addTo(layer);
      if (destination.name) {
        m.bindTooltip(destination.name, { direction: 'top', offset: [0, -10], className: 'unira-tooltip' });
      }
      bounds.extend([destination.lat, destination.lng]);
    }

    // Draw route polyline through all points
    if (allPoints.length >= 2) {
      const latlngs: L.LatLngExpression[] = allPoints.map(p => [p.lat, p.lng]);
      L.polyline(latlngs, {
        color: '#0EA5A0',
        weight: 4,
        opacity: 0.8,
        dashArray: '10, 14',
      }).addTo(layer);
    }

    // Fit bounds or set view
    if (origin && destination) {
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
      }
    } else if (origin) {
      map.setView([origin.lat, origin.lng], 14);
    } else if (userLocation) {
      // Already centered on user location
    } else {
      map.setView(DEFAULT_CENTER, 13);
    }
  }, [origin, destination, waypoints, userLocation]);

  // Selection mode cursor
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (selectMode) {
      container.style.cursor = 'crosshair';
    } else {
      container.style.cursor = '';
    }
  }, [selectMode]);

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
      <style>{`.unira-tooltip{background:#1F2937!important;color:#F9FAFB!important;border:none!important;border-radius:8px!important;padding:4px 10px!important;font-size:12px!important;font-weight:600!important;box-shadow:0 2px 8px rgba(0,0,0,0.15)!important}.unira-tooltip::before{border-top-color:#1F2937!important}.leaflet-control-attribution{display:none!important}.leaflet-control-zoom{border-radius:12px!important;border:none!important;box-shadow:0 2px 8px rgba(0,0,0,0.1)!important;overflow:hidden}.leaflet-control-zoom a{width:36px!important;height:36px!important;line-height:36px!important;color:#374151!important;font-size:16px!important}.leaflet-control-zoom a:hover{background:#f3f4f6!important}`}</style>
    </div>
  );
}
