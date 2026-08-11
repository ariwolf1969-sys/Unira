// Dynamic Pricing Algorithm for TEYEVO
// ─────────────────────────────────────────────────────────────────────
// Target: ~$15.000 ARS/hour average for TEYEVOAuto (base perMin = $250).
// Multipliers apply based on real-time conditions:
//   • Rain / bad weather
//   • Peak hours (AMBA rush hours)
//   • Demand vs. Supply ratio
//   • Weekend / holiday nights
//   • Special events (optional)
//
// The passenger app shows the final price BEFORE confirming the trip.
// If the route changes mid-trip (passenger takes a different path),
// the fare is recalculated in real-time based on new distance + time.

import { vehicleTypes, type VehicleType } from './places';

// ─── Weather conditions ──────────────────────────────────────────────

export type WeatherCondition = 'clear' | 'rain' | 'heavy_rain' | 'storm';

// Rain multiplier map
const WEATHER_MULTIPLIERS: Record<WeatherCondition, number> = {
  clear: 1.0,
  rain: 1.2,
  heavy_rain: 1.35,
  storm: 1.5,
};

// ─── Peak hours (AMBA timezone: America/Argentina/Buenos_Aires) ───────
// Weekday morning rush: 7:00–9:30
// Weekday evening rush: 17:00–20:00
// Weekend night: Friday 22:00 → Sunday 06:00 (reduced multiplier)

interface TimeSlot {
  name: string;
  multiplier: number;
  // Pairs of [startHour, endHour] in 24h format (can wrap midnight)
  hours: [number, number];
  days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
}

const PEAK_SLOTS: TimeSlot[] = [
  {
    name: 'Rush AM (weekday)',
    multiplier: 1.3,
    hours: [7, 9.5],
    days: [1, 2, 3, 4, 5], // Mon-Fri
  },
  {
    name: 'Rush PM (weekday)',
    multiplier: 1.35,
    hours: [17, 20],
    days: [1, 2, 3, 4, 5], // Mon-Fri
  },
  {
    name: 'Noche finde',
    multiplier: 1.25,
    hours: [22, 26], // 22:00 → 02:00 (26 = 2 AM next day)
    days: [5, 6, 0], // Fri, Sat, Sun
  },
  {
    name: 'Madrugada finde',
    multiplier: 1.15,
    hours: [0, 6],
    days: [0, 6], // Sun morning, Sat morning
  },
];

// ─── Demand vs Supply ────────────────────────────────────────────────
// demandSupplyRatio = (active trip requests in area) / (available drivers in area)
// < 0.5: lots of drivers, low demand → no surge
// 0.5–1.0: balanced → small surge
// 1.0–2.0: more demand than supply → moderate surge
// > 2.0: high demand, few drivers → strong surge

export function demandSupplyMultiplier(ratio: number): number {
  if (ratio <= 0.5) return 1.0;
  if (ratio <= 1.0) return 1.0 + (ratio - 0.5) * 0.2; // 1.0 → 1.1
  if (ratio <= 2.0) return 1.1 + (ratio - 1.0) * 0.4; // 1.1 → 1.5
  return Math.min(2.5, 1.5 + (ratio - 2.0) * 0.5); // 1.5 → 2.5 (capped)
}

// ─── Minimum fare ───────────────────────────────────────────────────
// Even a 1-block trip should cost at least this much.

const MIN_FARE: Record<string, number> = {
  moto: 2500,
  auto_2_puertas: 3000,
  auto_4_puertas: 3500,
  auto_alta_gama: 6000,
  trafic_8: 7000,
  van_7: 6000,
  camioneta_carga: 5500,
  mudanza: 8000,
  traslado_animales: 5000,
  discapacitados: 4500,
  lancha: 12000,
};

// ─── Core pricing function ──────────────────────────────────────────

export interface DynamicPricingInput {
  distanceKm: number;
  durationMin: number;
  vehicleTypeId: string;
  weather?: WeatherCondition;
  demandSupplyRatio?: number;
  isHoliday?: boolean;
}

export interface DynamicPricingOutput {
  baseFare: number;         // fare before multipliers
  distanceFare: number;     // km component
  timeFare: number;         // time component
  surgeMultiplier: number;   // total multiplier applied
  surgeBreakdown: {
    weather: number;
    peakHour: number;
    demandSupply: number;
    holiday: number;
  };
  finalFare: number;        // final price shown to passenger
  driverEarnings: number;   // net after commission
  commission: number;       // platform cut
  estimatedHourlyRate: number; // driver's hourly rate estimate
  minFareApplied: boolean;
}

/**
 * Calculate dynamic fare with all surge multipliers.
 * The base perMin for TEYEVOAuto is $250 ($15,000/hr) at 1.0x multiplier.
 */
export function calculateDynamicFare(input: DynamicPricingInput): DynamicPricingOutput {
  const vt = vehicleTypes.find((v) => v.id === input.vehicleTypeId);
  if (!vt) return defaultOutput(input.vehicleTypeId);

  // Base fare components
  const distanceFare = input.distanceKm * vt.perKm;
  const timeFare = input.durationMin * vt.perMin;
  const baseFare = vt.basePrice + distanceFare + timeFare;

  // ── Calculate multipliers ──
  const weather = input.weather ?? 'clear';
  const weatherMul = WEATHER_MULTIPLIERS[weather] ?? 1.0;

  const peakMul = getCurrentPeakMultiplier(input.isHoliday ?? false);

  const dsRatio = input.demandSupplyRatio ?? 0.5;
  const dsMul = demandSupplyMultiplier(dsRatio);

  // Holiday multiplier
  const holidayMul = input.isHoliday ? 1.15 : 1.0;

  // Total surge = product of all multipliers
  // We use multiplicative combination so that rain + peak + high demand stacks
  const totalMultiplier = weatherMul * peakMul * dsMul * holidayMul;

  // Apply surge only to the distance and time components (base stays fixed)
  const surgedFare = vt.basePrice + (distanceFare + timeFare) * totalMultiplier;

  // Minimum fare check
  const minFare = MIN_FARE[input.vehicleTypeId] ?? 3500;
  const finalFare = Math.max(minFare, Math.round(surgedFare / 10) * 10);

  // Driver earnings (8% commission for non-socios)
  const commission = Math.round((finalFare * vt.commissionPct) / 100);
  const driverEarnings = finalFare - commission;

  // Estimated hourly rate for the driver
  const estimatedHourlyRate = input.durationMin > 0
    ? Math.round((driverEarnings / input.durationMin) * 60)
    : 0;

  return {
    baseFare: Math.round(baseFare / 10) * 10,
    distanceFare: Math.round(distanceFare / 10) * 10,
    timeFare: Math.round(timeFare / 10) * 10,
    surgeMultiplier: Math.round(totalMultiplier * 100) / 100,
    surgeBreakdown: {
      weather: Math.round(weatherMul * 100) / 100,
      peakHour: Math.round(peakMul * 100) / 100,
      demandSupply: Math.round(dsMul * 100) / 100,
      holiday: Math.round(holidayMul * 100) / 100,
    },
    finalFare,
    driverEarnings,
    commission,
    estimatedHourlyRate,
    minFareApplied: finalFare === minFare && minFare > surgedFare,
  };
}

/**
 * Recalculate fare when the route changes mid-trip.
 * Uses the NEW distance and elapsed time, applying current conditions.
 */
export function recalculateFare(
  newDistanceKm: number,
  elapsedMin: number,
  vehicleTypeId: string,
  originalBaseFare: number,
  weather?: WeatherCondition,
  demandSupplyRatio?: number
): DynamicPricingOutput {
  return calculateDynamicFare({
    distanceKm: newDistanceKm,
    durationMin: elapsedMin,
    vehicleTypeId,
    weather,
    demandSupplyRatio,
  });
}

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Get the current peak-hour multiplier based on the time in Buenos Aires.
 */
export function getCurrentPeakMultiplier(isHoliday: boolean = false): number {
  if (isHoliday) return 1.1; // mild holiday surge

  const now = new Date();
  // Convert to Buenos Aires time
  const options: Intl.DateTimeFormatOptions = { timeZone: 'America/Argentina/Buenos_Aires' };
  const buenosAiresStr = now.toLocaleString('en-US', { ...options, hour12: false });
  const parts = buenosAiresStr.split(', ');
  const timePart = parts[parts.length - 1]; // "HH:MM:SS"
  const [hours, minutes] = timePart.split(':').map(Number);
  const hourDecimal = hours + minutes / 60;
  const dayOfWeek = new Date(buenosAiresStr).getDay(); // might be off due to parsing; use the date portion

  // Recalculate day of week properly
  const baDateStr = now.toLocaleDateString('en-US', { ...options, weekday: 'numeric' });
  // Actually, let's use a simpler approach
  const baHour = parseInt(
    now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires', hour: 'numeric', hour12: false })
  );
  const baMinute = parseInt(
    now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires', minute: 'numeric' })
  );
  const currentHourDecimal = baHour + baMinute / 60;

  // Get day of week in Buenos Aires
  const baDay = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' })
  ).getDay();

  let maxMultiplier = 1.0;
  for (const slot of PEAK_SLOTS) {
    if (!slot.days.includes(baDay)) continue;
    const [start, end] = slot.hours;
    if (end > 24) {
      // Wraps midnight: e.g., 22:00 → 02:00
      if (currentHourDecimal >= start || currentHourDecimal < end - 24) {
        maxMultiplier = Math.max(maxMultiplier, slot.multiplier);
      }
    } else {
      if (currentHourDecimal >= start && currentHourDecimal < end) {
        maxMultiplier = Math.max(maxMultiplier, slot.multiplier);
      }
    }
  }
  return maxMultiplier;
}

/**
 * Get a human-readable description of the current surge conditions.
 */
export function getSurgeDescription(pricing: DynamicPricingOutput): string {
  const parts: string[] = [];
  const { surgeBreakdown } = pricing;

  if (surgeBreakdown.weather > 1.0) {
    const labels: Record<string, string> = {
      '1.2': 'Lluvia leve',
      '1.35': 'Lluvia fuerte',
      '1.5': 'Tormenta',
    };
    parts.push(labels[surgeBreakdown.weather.toString()] || 'Clima adverso');
  }
  if (surgeBreakdown.peakHour > 1.0) {
    parts.push('Horario pico');
  }
  if (surgeBreakdown.demandSupply > 1.05) {
    parts.push('Alta demanda');
  }
  if (surgeBreakdown.holiday > 1.0) {
    parts.push('Feriado');
  }

  if (parts.length === 0) return 'Tarifa normal';
  return parts.join(' + ');
}

/**
 * Estimate weather condition based on simple heuristics.
 * In production, this would call a weather API.
 * For now, returns 'clear' — the API endpoint will accept weather from client
 * or from a weather service integration.
 */
export function estimateWeather(_lat: number, _lng: number): WeatherCondition {
  // TODO: integrate with OpenWeatherMap or similar API
  return 'clear';
}

function defaultOutput(vehicleTypeId: string): DynamicPricingOutput {
  return {
    baseFare: 0,
    distanceFare: 0,
    timeFare: 0,
    surgeMultiplier: 1.0,
    surgeBreakdown: { weather: 1.0, peakHour: 1.0, demandSupply: 1.0, holiday: 1.0 },
    finalFare: MIN_FARE[vehicleTypeId] ?? 3500,
    driverEarnings: 0,
    commission: 0,
    estimatedHourlyRate: 0,
    minFareApplied: true,
  };
}
