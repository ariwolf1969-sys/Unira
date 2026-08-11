import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  interpolateAlongRoute,
  computeProgressAlongRoute,
  computeEtaMin,
  routeDistance,
  type LatLng,
} from '@/lib/route';

export const runtime = 'nodejs';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/trips/[id]/location — driver (or simulated passenger) broadcasts
// their current GPS position. Updates Trip.currentLat/Lng/heading/speed/
// locationUpdatedAt so other consumers (share page, passenger polling) can
// read it via GET below.
//
// Body: { userId, lat, lng, heading?, speed? }
// Auth: lightweight — caller must know the tripId AND the userId that owns
// the trip (passenger broadcasting during demo) or be the assigned driver
// (when driver app exists — Grupo L). No token required for now since the
// tripId is already a random CUID, which is the secret.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await params;
    const body = await request.json();
    const { userId, lat, lng, heading, speed } = body as {
      userId?: string;
      lat?: number;
      lng?: number;
      heading?: number;
      speed?: number;
    };

    if (!userId || typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        { error: 'userId, lat y lng son requeridos' },
        { status: 400 }
      );
    }

    // Validate ranges
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { error: 'Coordenadas fuera de rango' },
        { status: 400 }
      );
    }

    // Find the trip
    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    }

    // Authorization: only the passenger who owns the trip or the assigned driver
    // can broadcast location for it.
    const isPassenger = trip.userId === userId;
    const isDriver = !!trip.driverId && trip.driverId === userId;
    if (!isPassenger && !isDriver) {
      return NextResponse.json(
        { error: 'No tenés permiso para actualizar este viaje' },
        { status: 403 }
      );
    }

    // Update trip with new live position
    await prisma.trip.update({
      where: { id: tripId },
      data: {
        currentLat: lat,
        currentLng: lng,
        currentHeading: typeof heading === 'number' ? heading : null,
        currentSpeed: typeof speed === 'number' ? speed : null,
        locationUpdatedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('POST /api/trips/[id]/location error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/trips/[id]/location — returns the driver's current live position
// along with derived progress and ETA. Used by:
//   - RideScreen's `in_trip` step (passenger polling for live driver position)
//   - The public share page (/viaje/[token]) indirectly via /api/share/[token]
//
// Query: ?userId=<userId> — optional auth (lightweight check that the caller
//        is involved in the trip). If absent, returns data anyway since the
//        tripId itself acts as the secret. Public share viewers don't know
//        the tripId (they only know the share token), so this is acceptable.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await params;
    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    }

    // Parse route polyline (used for fallback + progress computation)
    let route: LatLng[] = [];
    if (trip.route) {
      try {
        route = JSON.parse(trip.route) as LatLng[];
      } catch {
        route = [];
      }
    }

    const dest = { lat: trip.destLat, lng: trip.destLng };

    // ── Determine the "current position" to report ──
    // 1. If we have a recent live GPS ping (< 60s old), use it.
    // 2. Otherwise, fall back to time-based interpolated simulation.
    const STALE_MS = 60_000;
    const nowMs = Date.now();
    const hasLivePing =
      trip.currentLat !== null &&
      trip.currentLng !== null &&
      trip.locationUpdatedAt !== null &&
      nowMs - trip.locationUpdatedAt.getTime() < STALE_MS;

    let currentPos: { lat: number; lng: number } | null = null;
    let progress = 0;
    let remainingMin = 0;
    let isLive = false;

    if (hasLivePing && trip.currentLat !== null && trip.currentLng !== null) {
      // ── Live mode ──
      currentPos = { lat: trip.currentLat, lng: trip.currentLng };
      isLive = true;
      if (route.length >= 2) {
        progress = computeProgressAlongRoute(route, currentPos);
      } else {
        // Without a route, can't compute progress — use haversine ratio
        const origin = { lat: trip.originLat, lng: trip.originLng };
        const total = haversineKmSafe(origin.lat, origin.lng, dest.lat, dest.lng);
        const remaining = haversineKmSafe(currentPos.lat, currentPos.lng, dest.lat, dest.lng);
        progress = total > 0 ? Math.min(1, Math.max(0, 1 - remaining / total)) : 0;
      }
      remainingMin = computeEtaMin(currentPos, dest);
    } else {
      // ── Fallback: time-based simulation (kept for resilience if driver pings stop) ──
      const createdAtMs = trip.createdAt.getTime();
      const elapsedSec = Math.max(0, (nowMs - createdAtMs) / 1000);
      const totalTripSec = Math.max(60, (trip.duration ?? 15) * 60);
      progress = Math.min(1, elapsedSec / totalTripSec);
      if (trip.status === 'completed') progress = 1;
      currentPos = interpolateAlongRoute(route, progress) ?? {
        lat: trip.originLat,
        lng: trip.originLng,
      };
      remainingMin = Math.max(0, Math.ceil((1 - progress) * (trip.duration ?? 15)));
    }

    if (trip.status === 'completed') {
      progress = 1;
      remainingMin = 0;
    }

    return NextResponse.json({
      trip: {
        id: trip.id,
        status: trip.status,
        destLat: trip.destLat,
        destLng: trip.destLng,
        originLat: trip.originLat,
        originLng: trip.originLng,
      },
      location: {
        lat: currentPos.lat,
        lng: currentPos.lng,
        heading: trip.currentHeading ?? null,
        speed: trip.currentSpeed ?? null,
        updatedAt: trip.locationUpdatedAt?.toISOString() ?? null,
        isLive,
      },
      progress,
      remainingMin,
      routeDistanceKm: route.length >= 2 ? routeDistance(route) : null,
    });
  } catch (error) {
    console.error('GET /api/trips/[id]/location error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

function haversineKmSafe(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
