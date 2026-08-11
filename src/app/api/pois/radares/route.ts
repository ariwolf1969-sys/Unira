import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/pois/radares
 *
 * Returns speed cameras (radares) from OpenStreetMap's Overpass API, cached
 * for 24h in-memory. Falls back to a small static list of well-known BA
 * radars if Overpass is unreachable.
 *
 * Query params:
 *   - bbox: "south,west,north,east" — limit results to bounding box (default: BA region)
 *
 * Response:
 *   { radares: [{ id, lat, lng, type, maxspeed?, street? }], source, cachedAt, warning? }
 */

// Static fallback — well-known BA radars
const STATIC_RADARES: RadarPoint[] = [
  { id: 'static-1', lat: -34.6037, lng: -58.3816, type: 'fixed', maxspeed: 40, street: 'Av. Corrientes' },
  { id: 'static-2', lat: -34.5875, lng: -58.4170, type: 'fixed', maxspeed: 60, street: 'Av. Cabildo' },
  { id: 'static-3', lat: -34.5722, lng: -58.4470, type: 'fixed', maxspeed: 80, street: 'Panamericana' },
  { id: 'static-4', lat: -34.6308, lng: -58.3704, type: 'fixed', maxspeed: 60, street: 'Av. 9 de Julio' },
  { id: 'static-5', lat: -34.5567, lng: -58.4633, type: 'fixed', maxspeed: 70, street: 'Av. General Paz' },
  { id: 'static-6', lat: -34.6076, lng: -58.4493, type: 'fixed', maxspeed: 60, street: 'Av. Rivadavia' },
  { id: 'static-7', lat: -34.5700, lng: -58.4400, type: 'fixed', maxspeed: 60, street: 'Av. Cabildo' },
  { id: 'static-8', lat: -34.6217, lng: -58.3600, type: 'mobile', maxspeed: 60, street: 'Av. 25 de Mayo' },
];

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface RadarPoint {
  id: string;
  lat: number;
  lng: number;
  type: string;        // 'fixed' | 'mobile' | 'average_speed'
  maxspeed?: number;
  street?: string;
}

async function fetchFromOverpass(bbox?: string): Promise<RadarPoint[]> {
  const queryBbox = bbox || '-34.75,-58.6,-34.5,-58.25';
  const [south, west, north, east] = queryBbox.split(',').map(Number);

  const overpassQuery = `
    [out:json][timeout:25];
    (
      node["highway"="speed_camera"](${south},${west},${north},${east});
      way["highway"="speed_camera"](${south},${west},${north},${east});
      node["enforcement"="maxspeed"](${south},${west},${north},${east});
    );
    out body;
  `;

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(overpassQuery),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const data = await res.json();

  return ((data.elements || []) as any[]).map((el): RadarPoint => {
    const tags = el.tags || {};
    return {
      id: `overpass-${el.id}`,
      lat: el.lat,
      lng: el.lon,
      type: tags['speed_camera'] === 'mobile' || tags['enforcement'] === 'mobile' ? 'mobile' : 'fixed',
      maxspeed: tags['maxspeed'] ? parseInt(tags['maxspeed'], 10) : undefined,
      street: tags['name'] || tags['addr:street'] || undefined,
    };
  }).filter((r) => r.lat && r.lng);
}

// In-memory cache (per server instance)
let inMemoryCache: { radares: RadarPoint[]; cachedAt: number } | null = null;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bbox = searchParams.get('bbox') || undefined;

  const now = Date.now();
  if (inMemoryCache && (now - inMemoryCache.cachedAt) < CACHE_TTL_MS) {
    return NextResponse.json({
      radares: inMemoryCache.radares,
      source: 'cache',
      cachedAt: inMemoryCache.cachedAt,
    });
  }

  try {
    const radares = await fetchFromOverpass(bbox);
    if (radares.length > 0) {
      inMemoryCache = { radares, cachedAt: now };
      return NextResponse.json({ radares, source: 'overpass', cachedAt: now });
    }
  } catch (err) {
    console.warn('[/api/pois/radares] Overpass failed:', err);
  }

  return NextResponse.json({
    radares: STATIC_RADARES,
    source: 'static',
    cachedAt: now,
    warning: 'Overpass API no disponible. Mostrando radares conocidos de CABA como respaldo.',
  });
}
