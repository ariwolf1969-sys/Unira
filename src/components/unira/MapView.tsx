'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface MapViewProps {
  origin: { lat: number; lng: number; name: string } | null;
  destination: { lat: number; lng: number; name: string } | null;
}

export default function MapView({ origin, destination }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false }).setView([-34.6037, -58.3816], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const fixSize = () => { if (mapRef.current) mapRef.current.invalidateSize(); };
    setTimeout(fixSize, 100); setTimeout(fixSize, 300); setTimeout(fixSize, 600);
    window.addEventListener('resize', fixSize);
    return () => { window.removeEventListener('resize', fixSize); map.remove(); mapRef.current = null; layerRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current; const layer = layerRef.current; if (!map || !layer) return;
    layer.clearLayers(); const bounds: L.LatLngBounds = L.latLngBounds([]);
    if (origin) { const m = L.circleMarker([origin.lat, origin.lng], { radius: 8, fillColor: '#22C55E', fillOpacity: 1, color: '#fff', weight: 3 }); m.addTo(layer); if (origin.name) m.bindTooltip(origin.name, { direction: 'top', offset: [0, -10], className: 'unira-tooltip' }); bounds.extend([origin.lat, origin.lng]); }
    if (destination) { const m = L.circleMarker([destination.lat, destination.lng], { radius: 8, fillColor: '#EF4444', fillOpacity: 1, color: '#fff', weight: 3 }); m.addTo(layer); if (destination.name) m.bindTooltip(destination.name, { direction: 'top', offset: [0, -10], className: 'unira-tooltip' }); bounds.extend([destination.lat, destination.lng]); }
    if (origin && destination) { L.polyline([[origin.lat, origin.lng], [destination.lat, destination.lng]], { color: '#0EA5A0', weight: 4, opacity: 0.8, dashArray: '10, 14' }).addTo(layer); if (bounds.isValid()) map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 }); } else if (origin) { map.setView([origin.lat, origin.lng], 14); } else { map.setView([-34.6037, -58.3816], 13); }
  }, [origin, destination]);

  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full rounded-2xl" style={{ zIndex: 0 }} />
      <style>{`.unira-tooltip{background:#1F2937!important;color:#F9FAFB!important;border:none!important;border-radius:8px!important;padding:4px 10px!important;font-size:12px!important;font-weight:600!important;box-shadow:0 2px 8px rgba(0,0,0,0.15)!important}.unira-tooltip::before{border-top-color:#1F2937!important}.leaflet-control-attribution{display:none!important}.leaflet-control-zoom{display:none!important}`}</style>
    </div>
  );
}
