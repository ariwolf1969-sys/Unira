// ── Dangerous zones in AMBA (CABA + Greater Buenos Aires) ──────────────
// Curated list of neighborhoods/zones that have a well-documented history
// of security concerns, based on public news reports and government advisories.
// Used to warn drivers and passengers with a non-blocking banner — NOT to
// block trips, only to inform.
//
// Coordinates are approximate centroids of each neighborhood. The default
// warning radius is 600m around the centroid (configurable per-zone).

export interface DangerousZone {
  name: string;
  lat: number;
  lng: number;
  /** Warning radius in meters */
  radiusM: number;
  /** Short, neutral advisory text shown in the UI */
  note: string;
}

export const DANGEROUS_ZONES: DangerousZone[] = [
  // ── CABA villas (informal settlements) ──
  { name: 'Villa 31 (Retiro)', lat: -34.5847, lng: -58.3742, radiusM: 700, note: 'Zona con alta inseguridad documentada. Conducción con precaución.' },
  { name: 'Villa 1-11-14 (Bajo Flores)', lat: -34.6602, lng: -58.4598, radiusM: 800, note: 'Zona con alta inseguridad documentada. Conducción con precaución.' },
  { name: 'Villa 21-24 (Barracas)', lat: -34.6427, lng: -58.3716, radiusM: 700, note: 'Zona con alta inseguridad documentada. Conducción con precaución.' },
  { name: 'Villa 15 (Ciudad Oculta - Lugano)', lat: -34.6836, lng: -58.4722, radiusM: 800, note: 'Zona con alta inseguridad documentada. Conducción con precaución.' },
  { name: 'Villa 20 (Lugano)', lat: -34.6869, lng: -58.4633, radiusM: 600, note: 'Zona con alta inseguridad documentada. Conducción con precaución.' },
  { name: 'Villa 3 (Parque Avellaneda)', lat: -34.6476, lng: -58.4822, radiusM: 600, note: 'Zona con alta inseguridad documentada. Conducción con precaución.' },
  { name: 'Rodrigo Bueno (Costanera Sur)', lat: -34.6150, lng: -58.3617, radiusM: 500, note: 'Zona con alta inseguridad documentada. Conducción con precaución.' },

  // ── Greater Buenos Aires — critical zones ──
  { name: 'Barrio Carlos Gardel (Lanús)', lat: -34.7172, lng: -58.3947, radiusM: 600, note: 'Zona con antecedentes de inseguridad. Evitar estacionar.' },
  { name: 'Barrio San Martín (Lanús)', lat: -34.7197, lng: -58.3883, radiusM: 600, note: 'Zona con antecedentes de inseguridad. Evitar estacionar.' },
  { name: 'Villa Tranquila (Avellaneda)', lat: -34.6900, lng: -58.3717, radiusM: 700, note: 'Zona con antecedentes de inseguridad. Evitar estacionar.' },
  { name: 'Villa Inflamable (Dock Sud)', lat: -34.6750, lng: -58.3472, radiusM: 800, note: 'Zona industrial con antecedentes de inseguridad.' },
  { name: 'La Cárcova (San Martín)', lat: -34.5617, lng: -58.5450, radiusM: 700, note: 'Zona con antecedentes de inseguridad. Evitar estacionar.' },
  { name: 'Villa Hidalgo (San Martín)', lat: -34.5533, lng: -58.5383, radiusM: 600, note: 'Zona con antecedentes de inseguridad. Evitar estacionar.' },
  { name: 'Barrio Las Lomas (San Isidro)', lat: -34.4917, lng: -58.5283, radiusM: 600, note: 'Zona con antecedentes de inseguridad. Evitar estacionar.' },
  { name: 'La Cava (San Isidro)', lat: -34.4817, lng: -58.5300, radiusM: 600, note: 'Zona con antecedentes de inseguridad. Evitar estacionar.' },
  { name: 'Barrio San Jorge (Vicente López)', lat: -34.5233, lng: -58.4883, radiusM: 500, note: 'Zona con antecedentes de inseguridad. Evitar estacionar.' },
  { name: 'Villa Japonés (Morón)', lat: -34.6467, lng: -58.6250, radiusM: 500, note: 'Zona con antecedentes de inseguridad. Evitar estacionar.' },
  { name: 'Barrio Sarmiento (Merlo)', lat: -34.6883, lng: -58.7250, radiusM: 600, note: 'Zona con antecedentes de inseguridad. Evitar estacionar.' },
  { name: 'Barrio La Juanita (La Matanza)', lat: -34.7083, lng: -58.5850, radiusM: 600, note: 'Zona con antecedentes de inseguridad. Evitar estacionar.' },
  { name: 'Rafael Castillo (La Matanza)', lat: -34.6833, lng: -58.5833, radiusM: 600, note: 'Zona con antecedentes de inseguridad. Evitar estacionar.' },
  { name: 'Villa Centenario (La Matanza)', lat: -34.6889, lng: -58.5694, radiusM: 500, note: 'Zona con antecedentes de inseguridad. Evitar estacionar.' },
  { name: 'Barrio María Elena (Pilar)', lat: -34.4667, lng: -58.7667, radiusM: 600, note: 'Zona con antecedentes de inseguridad. Evitar estacionar.' },
];

const EARTH_RADIUS_M = 6_371_000;

/** Haversine distance in meters between two coordinates. */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

/**
 * Returns the dangerous zone that contains the given point (if any).
 * A point is considered "in" a zone if its distance from the zone centroid
 * is less than the zone's radiusM.
 */
export function findDangerousZone(
  lat: number,
  lng: number
): DangerousZone | null {
  for (const zone of DANGEROUS_ZONES) {
    const dist = haversineMeters(lat, lng, zone.lat, zone.lng);
    if (dist <= zone.radiusM) return zone;
  }
  return null;
}

/** Returns all zones that overlap a given viewport (for map overlays). */
export function zonesNearPoint(
  lat: number,
  lng: number,
  radiusKm = 5
): DangerousZone[] {
  const radiusM = radiusKm * 1000;
  return DANGEROUS_ZONES.filter(
    (z) => haversineMeters(lat, lng, z.lat, z.lng) <= radiusM + z.radiusM
  );
}
