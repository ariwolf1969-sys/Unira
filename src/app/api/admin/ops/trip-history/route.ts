import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const adminUserId = searchParams.get('adminUserId');

    if (!adminUserId) {
      return NextResponse.json({ error: 'Missing adminUserId' }, { status: 400 });
    }

    // Verify admin
    const admin = await prisma.user.findUnique({ where: { id: adminUserId } });
    if (!admin?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const since = new Date();
    since.setHours(since.getHours() - 24);

    const trips = await prisma.trip.findMany({
      where: {
        createdAt: { gte: since },
        status: { in: ['completed', 'in_progress', 'cancelled'] },
      },
      select: {
        id: true,
        status: true,
        originName: true,
        originAddress: true,
        originLat: true,
        originLng: true,
        destName: true,
        destAddress: true,
        destLat: true,
        destLng: true,
        fare: true,
        distance: true,
        duration: true,
        route: true,
        routePolyline: true,
        driverId: true,
        driverName: true,
        userId: true,
        vehicleType: true,
        paymentMethod: true,
        acceptedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Flag trips with potential route manipulation
    // If duration > 1.5x expected (based on distance/speed of ~30km/h average in BA)
    const enrichedTrips = trips.map((t) => {
      const distanceKm = t.distance || 0;
      const durationMin = t.duration || 0;
      // Expected duration at 25 km/h average urban speed
      const expectedMin = distanceKm > 0 ? (distanceKm / 25) * 60 : 0;
      const isFlagged = expectedMin > 0 && durationMin > expectedMin * 1.5;
      return {
        ...t,
        routePoints: t.route ? parseRoute(t.route) : [],
        isFlagged,
        expectedDurationMin: Math.round(expectedMin),
      };
    });

    return NextResponse.json({ trips: enrichedTrips });
  } catch (error) {
    console.error('[ops/trip-history] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Parse route field which can be JSON string "[[lat,lng],...]" or empty */
function parseRoute(route: string | null): [number, number][] {
  if (!route) return [];
  try {
    const parsed = JSON.parse(route);
    if (Array.isArray(parsed)) {
      return parsed.map((p: unknown) => {
        if (Array.isArray(p) && p.length >= 2) {
          return [Number(p[0]), Number(p[1])] as [number, number];
        }
        return null;
      }).filter((p): p is [number, number] => p !== null);
    }
  } catch {
    // Not valid JSON, return empty
  }
  return [];
}
