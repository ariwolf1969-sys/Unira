/**
 * Smart geocoding utility for Unira
 *
 * Problems it solves:
 * 1. Nominatim searches fail for small towns if you don't include the city name
 * 2. GPS in rural Argentina can be off by 2km — we need viewbox bias
 * 3. Local POIs ("Nuestro Lugar en el Mundo") aren't in OSM
 * 4. The app needs to "know" what city the user is in
 *
 * Strategy:
 * - Reverse-geocode the GPS position once to detect the city/area
 * - Append the city name to all forward geocoding queries
 * - Use viewbox parameter to bias results near the user
 * - Fall back to curated local POIs when Nominatim returns nothing
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
  importance?: number;
}

export interface DetectedArea {
  city: string;
  state: string;
  country: string;
  fullAddress: string;
  // bounding box for viewbox bias (lng1, lat1, lng2, lat2)
  viewbox: string;
}

// ─── Cache ──────────────────────────────────────────────────────────────────

let cachedArea: DetectedArea | null = null;
let areaDetectionPromise: Promise<DetectedArea | null> | null = null;

// ─── Reverse geocode to detect city/area ────────────────────────────────────

export async function detectArea(lat: number, lng: number): Promise<DetectedArea | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=12&addressdetails=1&accept-language=es`,
      { headers: { 'User-Agent': 'UniraApp/1.0 (cooperativa ride)' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address || {};

    // Try to get the most specific city/town name
    const city = addr.city || addr.town || addr.village || addr.locality || addr.suburb || '';
    const state = addr.state || '';
    const country = addr.country || 'Argentina';

    if (!city) return null;

    // Build viewbox: ~15km radius around the point for biasing searches
    const delta = 0.12; // ~13km at these latitudes
    const viewbox = `${(lng - delta).toFixed(4)},${(lat + delta).toFixed(4)},${(lng + delta).toFixed(4)},${(lat - delta).toFixed(4)}`;

    cachedArea = {
      city,
      state,
      country,
      fullAddress: `${city}, ${state}`,
      viewbox,
    };
    return cachedArea;
  } catch {
    return null;
  }
}

/**
 * Get the detected area, either from cache or by detecting from GPS coords.
 * Uses a singleton promise to avoid multiple concurrent detections.
 */
export async function getDetectedArea(lat: number, lng: number): Promise<DetectedArea | null> {
  if (cachedArea) return cachedArea;
  if (!areaDetectionPromise) {
    areaDetectionPromise = detectArea(lat, lng);
  }
  const result = await areaDetectionPromise;
  if (!result) {
    areaDetectionPromise = null; // Allow retry
  }
  return result;
}

/** Reset cached area (e.g., when user location changes significantly) */
export function resetDetectedArea() {
  cachedArea = null;
  areaDetectionPromise = null;
}

// ─── Smart forward geocoding ─────────────────────────────────────────────────

const NOMINATIM_HEADERS = {
  'Accept-Language': 'es',
  'User-Agent': 'UniraApp/1.0 (cooperativa ride)',
};

/**
 * Search for addresses using Nominatim with smart enhancements:
 * - Appends detected city name to improve results for small towns
 * - Uses viewbox to bias toward user's current area
 * - Falls back to local POIs if no results
 */
export async function smartSearch(
  query: string,
  userLat?: number,
  userLng?: number,
  localPlaces?: Array<{ name: string; address: string; lat: number; lng: number }>
): Promise<NominatimResult[]> {
  if (!query || query.trim().length < 2) return [];

  const trimmed = query.trim();

  // ── Step 1: Try to detect user's area if we have GPS ──
  let area = cachedArea;
  if (userLat && userLng && !area) {
    area = await getDetectedArea(userLat, userLng);
  }

  // ── Step 2: Build enhanced query ──
  // If we have a detected city, append it to the query (unless the query
  // already contains a recognizable city name)
  let enhancedQuery = trimmed;
  if (area) {
    const qLower = trimmed.toLowerCase();
    const areaLower = area.city.toLowerCase();
    // Only append city if the query doesn't already mention it
    if (!qLower.includes(areaLower)) {
      enhancedQuery = `${trimmed}, ${area.city}, ${area.state}`;
    }
  }

  // ── Step 3: Build Nominatim URL with viewbox ──
  const params = new URLSearchParams({
    format: 'json',
    q: enhancedQuery,
    countrycodes: 'ar',
    limit: '8',
    addressdetails: '1',
  });

  // Add viewbox bias if we have user location
  if (userLat && userLng) {
    const delta = 0.15; // ~15km
    params.set('viewbox', `${(userLng - delta).toFixed(4)},${(userLat + delta).toFixed(4)},${(userLng + delta).toFixed(4)},${(userLat - delta).toFixed(4)}`);
    // bounded=0 means "prefer results in viewbox but don't exclude others"
    params.set('bounded', '0');
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      { headers: NOMINATIM_HEADERS }
    );
    if (!res.ok) {
      if (res.status === 429) {
        console.warn('[geocoding] Nominatim rate limited, waiting...');
        await new Promise(r => setTimeout(r, 1100));
        // Retry once after rate limit delay
        const retryRes = await fetch(
          `https://nominatim.openstreetmap.org/search?${params.toString()}`,
          { headers: NOMINATIM_HEADERS }
        );
        if (!retryRes.ok) throw new Error('Nominatim rate limited');
        const retryData = await retryRes.json();
        if (retryData.length > 0) {
          return retryData.map((item: Record<string, unknown>) => ({
            place_id: item.place_id as number,
            display_name: item.display_name as string,
            lat: item.lat as string,
            lon: item.lon as string,
            type: item.type as string,
            class: item.class as string,
            importance: item.importance as number,
          }));
        }
        throw new Error('Nominatim no results after retry');
      }
      throw new Error(`Nominatim HTTP ${res.status}`);
    }
    const data = await res.json();

    if (data.length > 0) {
      return data.map((item: Record<string, unknown>) => ({
        place_id: item.place_id as number,
        display_name: item.display_name as string,
        lat: item.lat as string,
        lon: item.lon as string,
        type: item.type as string,
        class: item.class as string,
        importance: item.importance as number,
      }));
    }
  } catch (err) {
    console.warn('Nominatim search failed:', err);
  }

  // ── Step 4: Retry with just "city, state" if the enhanced query failed ──
  if (area) {
    try {
      const retryParams = new URLSearchParams({
        format: 'json',
        q: `${trimmed}, ${area.fullAddress}`,
        countrycodes: 'ar',
        limit: '5',
      });
      if (userLat && userLng) {
        const delta = 0.15;
        retryParams.set('viewbox', `${(userLng - delta).toFixed(4)},${(userLat + delta).toFixed(4)},${(userLng + delta).toFixed(4)},${(userLat - delta).toFixed(4)}`);
        retryParams.set('bounded', '0');
      }
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${retryParams.toString()}`,
        { headers: NOMINATIM_HEADERS }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) return data;
      }
    } catch {
      // ignore
    }
  }

  // ── Step 5: Fallback to local places ──
  if (localPlaces && localPlaces.length > 0) {
    const q = trimmed.toLowerCase();
    return localPlaces
      .filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q)
      )
      .slice(0, 5)
      .map((p, i) => ({
        place_id: 900000 + i,
        display_name: `${p.name} - ${p.address}`,
        lat: p.lat.toString(),
        lon: p.lng.toString(),
        type: 'local_fallback',
        class: 'place',
        importance: 0.5,
      }));
  }

  return [];
}

// ─── Smart reverse geocoding ────────────────────────────────────────────────

/**
 * Reverse geocode a coordinate to a human-readable address.
 * Returns a concise address string like "Av. 17 1234, Miramar"
 */
export async function smartReverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=es`,
      { headers: NOMINATIM_HEADERS }
    );
    if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const data = await res.json();
    const addr = data.address || {};

    // Build a nice short address
    const parts: string[] = [];
    if (addr.road) {
      if (addr.house_number) {
        parts.push(`${addr.road} ${addr.house_number}`);
      } else {
        parts.push(addr.road);
      }
    }
    if (addr.suburb && addr.suburb !== addr.city) {
      parts.push(addr.suburb);
    }
    if (addr.city || addr.town || addr.village) {
      parts.push(addr.city || addr.town || addr.village);
    }

    if (parts.length > 0) {
      return parts.join(', ');
    }

    // Fallback to display_name first few parts
    return (data.display_name || '').split(',').slice(0, 3).join(',').trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

// ─── Parse Nominatim display_name to Place ─────────────────────────────────

export function parseNominatimToPlace(
  displayName: string,
  lat: string,
  lon: string
): { name: string; address: string; lat: number; lng: number } {
  const parts = displayName.split(' - ');
  let rawName: string;
  let rawAddress: string;

  if (parts.length > 1) {
    // Already formatted by our fallback parser (local POI)
    rawName = parts[0].trim();
    rawAddress = parts.slice(1).join(' - ').trim();
  } else {
    // Nominatim format: comma-separated
    const commaParts = displayName.split(',').map(s => s.trim());
    if (commaParts.length >= 2) {
      const firstPart = commaParts[0];
      const secondPart = commaParts[1];
      if (/^\d+$/.test(firstPart)) {
        rawName = `${secondPart} ${firstPart}`;
      } else {
        rawName = firstPart;
      }
      // Address: take 2-3 meaningful parts after the first two
      rawAddress = commaParts.slice(2, 5).join(', ');
    } else {
      rawName = commaParts[0];
      rawAddress = '';
    }
  }

  return {
    name: rawName,
    address: rawAddress || displayName.split(',').slice(1, 4).join(', ').trim(),
    lat: parseFloat(lat),
    lng: parseFloat(lon),
  };
}
