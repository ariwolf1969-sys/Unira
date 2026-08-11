// Turn-by-Turn Navigation System for TEYEVO
// ─────────────────────────────────────────────────────────────────────
// Uses OSRM route steps to generate voice navigation instructions.
// Each step has a maneuver type, distance, and instruction text.
// The system triggers TTS (Text-to-Speech) when approaching each turn.

import type { LatLng } from './route';

// ─── Types ──────────────────────────────────────────────────────────

/** OSRM step annotation (parsed from the route steps response). */
export interface NavigationStep {
  /** Distance from start of this step to the next maneuver, in meters */
  distance: number;
  /** Duration in seconds */
  duration: number;
  /** Maneuver type (turn, roundabout, arrive, etc.) */
  type: string;
  /** Modifier (left, right, straight, slight left, etc.) */
  modifier?: string;
  /** Human-readable instruction from OSRM (English) */
  instruction: string;
  /** Instruction translated to Spanish */
  instructionEs: string;
  /** Coordinates at the maneuver point */
  location: LatLng;
  /** Name of the street for this segment */
  name: string;
  /** Cumulative distance from route start (meters) */
  cumulativeDistance: number;
  /** Cumulative duration from route start (seconds) */
  cumulativeDuration: number;
  /** Whether this instruction has already been announced */
  announced: boolean;
}

/** Voice navigation state */
export interface NavigationState {
  steps: NavigationStep[];
  currentStepIndex: number;
  /** Distance to next maneuver in meters */
  distanceToNextManeuver: number;
  /** Current instruction text (Spanish) */
  currentInstruction: string | null;
  /** Next instruction preview */
  nextInstruction: string | null;
  /** Current street name */
  currentStreet: string;
  /** Is voice navigation active */
  isActive: boolean;
}

// ─── OSRM Maneuver translation (English → Spanish) ───────────────────

const MANEUVER_TRANSLATIONS: Record<string, string> = {
  'depart': 'Salí',
  'arrive': 'Llegaste a tu destino',
  'turn': 'Girá',
  'new name': 'Continuá por',
  'merge': 'Incorporate',
  'on ramp': 'Tomá la rampa',
  'off ramp': 'Tomá la salida',
  'fork': 'En la bifurcación',
  'end of road': 'Al final de la calle',
  'continue': 'Continuá',
  'roundabout': 'En la rotonda',
  'rotary': 'En la rotonda',
};

const MODIFIER_TRANSLATIONS: Record<string, string> = {
  'left': 'a la izquierda',
  'right': 'a la derecha',
  'sharp left': 'fuerte a la izquierda',
  'sharp right': 'fuerte a la derecha',
  'slight left': 'ligeramente a la izquierda',
  'slight right': 'ligeramente a la derecha',
  'straight': 'sigue derecho',
  'uturn': 'dando vuelta',
};

// ─── Voice instruction generation ─────────────────────────────────────

/**
 * Generate a voice-ready instruction in Spanish for a navigation step.
 * These are designed to be clear and short for TTS.
 */
function generateVoiceInstruction(step: NavigationStep): string {
  const dist = step.distance;

  // Arrive — special case
  if (step.type === 'arrive') {
    return dist < 50
      ? 'Llegaste a tu destino.'
      : `En ${formatMetersForVoice(dist)}, llegás a tu destino.`;
  }

  // Depart
  if (step.type === 'depart') {
    return `Salí por ${step.name || 'la ruta'}.`;
  }

  // Roundabout
  if (step.type === 'roundabout' || step.type === 'rotary') {
    const exit = step.modifier ? step.modifier.replace('exit', 'salida') : '';
    return `En la rotonda, tomá ${exit ? 'la ' + exit : 'la salida'}. Continuá por ${step.name || 'la calle'}.`;
  }

  // Turn / fork / ramp
  if (['turn', 'fork', 'end of road', 'on ramp', 'off ramp'].includes(step.type)) {
    const direction = step.modifier ? MODIFIER_TRANSLATIONS[step.modifier] || step.modifier : 'derecho';
    const street = step.name ? ` por ${step.name}` : '';
    return `En ${formatMetersForVoice(dist)}, girá ${direction}${street}.`;
  }

  // Continue / new name
  if (step.type === 'continue' || step.type === 'new name' || step.type === 'merge') {
    const street = step.name ? ` por ${step.name}` : '';
    return `Continuá${street}.`;
  }

  // Fallback
  return step.instructionEs;
}

/**
 * Generate a short "approaching" instruction for when the driver is
 * within 200m of a maneuver.
 */
export function getApproachingInstruction(step: NavigationStep): string | null {
  if (step.type === 'arrive') {
    return 'Estás llegando al destino.';
  }
  if (step.type === 'depart') return null;

  const dist = step.distance;
  if (dist > 300) return null;

  if (['turn', 'fork', 'end of road', 'on ramp', 'off ramp', 'roundabout', 'rotary'].includes(step.type)) {
    const direction = step.modifier ? MODIFIER_TRANSLATIONS[step.modifier] || step.modifier : '';
    return `Pronto girá ${direction}.`;
  }
  return null;
}

// ─── Distance formatting for voice ───────────────────────────────────

function formatMetersForVoice(meters: number): string {
  if (meters < 100) return `${meters} metros`;
  if (meters < 1000) {
    // Round to nearest 50
    const rounded = Math.round(meters / 50) * 50;
    return `${rounded} metros`;
  }
  const km = (meters / 1000).toFixed(1);
  return `${km} kilómetros`;
}

// ─── Parse OSRM steps ───────────────────────────────────────────────

/**
 * Fetch turn-by-turn steps from OSRM and parse them into NavigationSteps.
 * Uses the OSRM `steps=true` parameter to get maneuver details.
 */
export async function fetchNavigationSteps(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  waypoints?: { lat: number; lng: number }[]
): Promise<NavigationStep[]> {
  const allPoints = [origin, ...(waypoints || []), destination];
  const osrmCoords = allPoints.map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${osrmCoords}?overview=full&geometries=geojson&steps=true`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM steps ${res.status}`);
    const data = await res.json();

    const legs = data.routes?.[0]?.legs;
    if (!legs || legs.length === 0) return [];

    const steps: NavigationStep[] = [];
    let cumDist = 0;
    let cumDur = 0;

    for (const leg of legs) {
      for (const step of leg.steps || []) {
        const maneuver = step.maneuver || {};
        const modifier = maneuver.modifier || undefined;
        const type = maneuver.type || 'continue';
        const instruction = step.name ? `${maneuver.instruction || ''} ${step.name}` : (maneuver.instruction || '');
        const instructionEs = translateInstruction(type, modifier, step.name || '');

        steps.push({
          distance: step.distance || 0,
          duration: step.duration || 0,
          type,
          modifier,
          instruction,
          instructionEs,
          location: step.maneuver?.location
            ? [step.maneuver.location[1], step.maneuver.location[0]] as LatLng
            : [0, 0],
          name: step.name || '',
          cumulativeDistance: cumDist,
          cumulativeDuration: cumDur,
          announced: false,
        });

        cumDist += step.distance || 0;
        cumDur += step.duration || 0;
      }
    }

    // Generate voice instructions for each step
    for (const step of steps) {
      step.instructionEs = generateVoiceInstruction(step);
    }

    return steps;
  } catch (err) {
    console.warn('[navigation] OSRM steps fetch failed:', err);
    return [];
  }
}

// ─── Translate instruction to Spanish ───────────────────────────────

function translateInstruction(type: string, modifier: string | undefined, name: string): string {
  const action = MANEUVER_TRANSLATIONS[type] || type;
  const direction = modifier ? MODIFIER_TRANSLATIONS[modifier] || modifier : '';
  const street = name ? ` ${name}` : '';

  if (type === 'arrive') return 'Llegaste a tu destino';
  if (type === 'depart') return `Salí por${street}`;
  if (type === 'roundabout' || type === 'rotary') return `En la rotonda, tomá la salida${street ? ' por ' + street : ''}`;

  if (['turn', 'fork', 'end of road', 'on ramp', 'off ramp'].includes(type)) {
    return `${action} ${direction}${street}`;
  }

  return `${action}${street}`;
}

// ─── TTS (Text-to-Speech) ────────────────────────────────────────────

let currentUtterance: SpeechSynthesisUtterance | null = null;

/**
 * Speak a navigation instruction using the Web Speech API.
 * Automatically selects a Spanish voice if available.
 */
export function speakInstruction(text: string, rate: number = 1.0): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-AR';
  utterance.rate = rate;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // Try to find a Spanish voice
  const voices = window.speechSynthesis.getVoices();
  const spanishVoice = voices.find(
    (v) => v.lang.startsWith('es') && !v.localService
  ) || voices.find(
    (v) => v.lang.startsWith('es')
  ) || voices.find(
    (v) => v.lang.startsWith('es-AR')
  );

  if (spanishVoice) {
    utterance.voice = spanishVoice;
  }

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

/**
 * Get available TTS voices filtered for Spanish.
 */
export function getSpanishVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith('es'));
}

/**
 * Preload voices (some browsers load them asynchronously).
 */
export function preloadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve([]);
      return;
    }
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices.filter((v) => v.lang.startsWith('es')));
      return;
    }
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      const allVoices = window.speechSynthesis.getVoices();
      resolve(allVoices.filter((v) => v.lang.startsWith('es')));
    }, { once: true });
  });
}

/**
 * Stop any ongoing TTS.
 */
export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  currentUtterance = null;
}

// ─── Navigation tracking ─────────────────────────────────────────────

/**
 * Find the current navigation step based on cumulative distance traveled.
 * Returns the index of the next upcoming maneuver.
 */
export function findCurrentStep(steps: NavigationStep[], distanceTraveledMeters: number): number {
  for (let i = 0; i < steps.length; i++) {
    if (distanceTraveledMeters < steps[i].cumulativeDistance + steps[i].distance) {
      return i;
    }
  }
  return steps.length - 1;
}

/**
 * Calculate distance to next maneuver from current position.
 */
export function distanceToNextStep(steps: NavigationStep[], currentIndex: number, distanceTraveledMeters: number): number {
  if (currentIndex >= steps.length) return 0;
  const stepCumEnd = steps[currentIndex].cumulativeDistance + steps[currentIndex].distance;
  return Math.max(0, stepCumEnd - distanceTraveledMeters);
}

/**
 * Check if we should announce the current step based on distance.
 * Announcements trigger at 300m and 50m before each maneuver.
 */
export function shouldAnnounce(
  steps: NavigationStep[],
  currentIndex: number,
  distanceTraveledMeters: number
): { shouldSpeak: boolean; text: string; isFinal: boolean } {
  const step = steps[currentIndex];
  if (!step || step.type === 'depart') return { shouldSpeak: false, text: '', isFinal: false };

  const distToEnd = distanceToNextStep(steps, currentIndex, distanceTraveledMeters);

  // Already announced and we're past the final announcement zone
  if (step.announced && distToEnd < 40) return { shouldSpeak: false, text: '', isFinal: false };

  // Final announcement (50m)
  if (distToEnd <= 50 && distToEnd > 10 && !step.announced) {
    return { shouldSpeak: true, text: `Ahora: ${step.instructionEs}`, isFinal: true };
  }

  // First announcement (300m)
  if (distToEnd <= 300 && distToEnd > 50 && !step.announced) {
    return { shouldSpeak: true, text: step.instructionEs, isFinal: false };
  }

  return { shouldSpeak: false, text: '', isFinal: false };
}
