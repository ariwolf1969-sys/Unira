import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SharedTrip } from '@prisma/client';

/**
 * POST /api/sos
 * Creates a new SosAlert. Called from the SosButton component right before
 * firing tel:911. We don't await this on the client (it fires in the background)
 * — the 911 call must take priority.
 *
 * Body: { userId, tripId?, shareToken?, lat?, lng? }
 *
 * If a shareToken is provided and matches an active SharedTrip, we link it
 * so the admin can click through to /viaje/[token] and see the live driver
 * position.
 *
 * We also auto-create a SharedTrip if there's an active trip but no token yet,
 * so the admin can always see the live position when there's an active trip.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, tripId, shareToken, lat, lng } = body as {
      userId: string;
      tripId?: string | null;
      shareToken?: string | null;
      lat?: number | null;
      lng?: number | null;
    };

    if (!userId) {
      return NextResponse.json({ error: 'Falta userId' }, { status: 400 });
    }

    // Validate coordinates if provided
    let latVal: number | null = null;
    let lngVal: number | null = null;
    if (typeof lat === 'number' && typeof lng === 'number') {
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return NextResponse.json({ error: 'Coordenadas inválidas' }, { status: 400 });
      }
      latVal = lat;
      lngVal = lng;
    }

    // If there's an active trip but no share token, create one so admin can
    // click through to the live tracking page.
    let finalShareToken: string | null = shareToken || null;
    if (tripId && !finalShareToken) {
      const existingShare = await prisma.sharedTrip.findFirst({
        where: { tripId, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });
      if (existingShare) {
        finalShareToken = existingShare.token;
      } else {
        // Create a new share token that expires in 24h
        const newShare: SharedTrip = await prisma.sharedTrip.create({
          data: {
            tripId,
            userId,
            token: Math.random().toString(36).slice(2) + Date.now().toString(36),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
        finalShareToken = newShare.token;
      }
    }

    const alert = await prisma.sosAlert.create({
      data: {
        userId,
        tripId: tripId || null,
        shareToken: finalShareToken,
        lat: latVal,
        lng: lngVal,
        status: 'active',
      },
    });

    return NextResponse.json({ ok: true, alertId: alert.id });
  } catch (err) {
    console.error('[POST /api/sos] error:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

/**
 * GET /api/sos
 * Returns all SOS alerts (for the admin panel).
 * Optionally pass ?status=active (default) | resolved | false_alarm.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'active';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    const alerts = await prisma.sosAlert.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Hydrate user info for each alert
    const userIds = [...new Set(alerts.map(a => a.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        isDriver: true,
      },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    return NextResponse.json({
      alerts: alerts.map(a => ({
        id: a.id,
        userId: a.userId,
        tripId: a.tripId,
        shareToken: a.shareToken,
        lat: a.lat,
        lng: a.lng,
        status: a.status,
        resolutionNote: a.resolutionNote,
        createdAt: a.createdAt,
        resolvedAt: a.resolvedAt,
        user: userMap.get(a.userId) || null,
      })),
    });
  } catch (err) {
    console.error('[GET /api/sos] error:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
