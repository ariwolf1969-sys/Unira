import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  interpolateAlongRoute,
  computeProgressAlongRoute,
  computeEtaMin,
  type LatLng,
} from '@/lib/route';

export const runtime = 'nodejs';

// GET /api/share/[token] — public endpoint, no auth required.
// Returns sanitized trip info for the share page (no PII beyond driver first name).
// Polling this endpoint every few seconds renders the driver's real-time position
// on the public map (Grupo J). Falls back to time-based interpolated simulation
// if no live GPS ping has been received in the last 60s.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const shared = await prisma.sharedTrip.findUnique({
      where: { token },
      include: {
        trip: true,
      },
    });

    if (!shared) {
      return NextResponse.json({ error: 'Enlace inválido' }, { status: 404 });
    }

    // Check expiration
    if (shared.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Este enlace de seguimiento expiró' },
        { status: 410 }
      );
    }

    // Increment view count (best-effort, fire-and-forget)
    void prisma.sharedTrip
      .update({
        where: { id: shared.id },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => {});

    const trip = shared.trip;

    // Parse route polyline
    let route: LatLng[] = [];
    if (trip.route) {
      try {
        route = JSON.parse(trip.route) as LatLng[];
      } catch {
        route = [];
      }
    }

    const dest = { lat: trip.destLat, lng: trip.destLng };

    // ── Determine current position ──
    // Grupo J: prefer live GPS ping if it's recent (< 60s).
    // Otherwise fall back to time-based interpolated simulation.
    const STALE_MS = 60_000;
    const nowMs = Date.now();
    const hasLivePing =
      trip.currentLat !== null &&
      trip.currentLng !== null &&
      trip.locationUpdatedAt !== null &&
      nowMs - trip.locationUpdatedAt.getTime() < STALE_MS;

    let currentPos: { lat: number; lng: number } | null = null;
    let progress: number;
    let remainingMin: number;
    let isLive = false;

    if (hasLivePing && trip.currentLat !== null && trip.currentLng !== null) {
      // ── Live mode: real driver GPS ──
      currentPos = { lat: trip.currentLat, lng: trip.currentLng };
      isLive = true;
      if (route.length >= 2) {
        progress = computeProgressAlongRoute(route, currentPos);
      } else {
        const origin = { lat: trip.originLat, lng: trip.originLng };
        const totalKm = haversine(origin.lat, origin.lng, dest.lat, dest.lng);
        const remainingKm = haversine(currentPos.lat, currentPos.lng, dest.lat, dest.lng);
        progress = totalKm > 0 ? Math.min(1, Math.max(0, 1 - remainingKm / totalKm)) : 0;
      }
      remainingMin = computeEtaMin(currentPos, dest);
    } else {
      // ── Fallback: time-based simulation ──
      const createdAtMs = trip.createdAt.getTime();
      const elapsedSec = Math.max(0, (nowMs - createdAtMs) / 1000);
      const totalTripSec = Math.max(60, (trip.duration ?? 15) * 60);
      progress = Math.min(1, elapsedSec / totalTripSec);
      currentPos = interpolateAlongRoute(route, progress);
      remainingMin = Math.max(0, Math.ceil((1 - progress) * (trip.duration ?? 15)));
    }

    // If trip is already completed, snap to 100% regardless of live position
    if (trip.status === 'completed') {
      progress = 1;
      remainingMin = 0;
    }

    // Driver first name only (privacy)
    const driverFirstName = trip.driverName
      ? trip.driverName.split(' ')[0]
      : null;

    return NextResponse.json({
      trip: {
        id: trip.id,
        type: trip.type,
        status: trip.status,
        originName: trip.originName,
        originAddress: trip.originAddress,
        destName: trip.destName,
        destAddress: trip.destAddress,
        originLat: trip.originLat,
        originLng: trip.originLng,
        destLat: trip.destLat,
        destLng: trip.destLng,
        driverFirstName,
        driverVehicle: trip.driverVehicle ?? null,
        vehicleType: trip.vehicleType ?? 'auto',
        fare: trip.fare,
        distance: trip.distance ?? null,
        duration: trip.duration ?? null,
        createdAt: trip.createdAt.toISOString(),
        progress,
        remainingMin,
        currentPos,
        route,
        isLive,
      },
      share: {
        expiresAt: shared.expiresAt.toISOString(),
        viewCount: shared.viewCount + 1,
      },
    });
  } catch (error) {
    console.error('GET /api/share/[token] error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
