import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * GET /api/admin/ops/driver/[id]?adminUserId=...
 * Returns driver detail with trip history, ratings, and stats.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = req.nextUrl;
    const adminUserId = searchParams.get('adminUserId');

    if (!adminUserId) {
      return NextResponse.json({ error: 'Missing adminUserId' }, { status: 400 });
    }

    const admin = await prisma.user.findUnique({ where: { id: adminUserId } });
    if (!admin?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get driver
    const driver = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        dni: true,
        avatar: true,
        isDriver: true,
        isDriverApproved: true,
        isOnline: true,
        verificationStatus: true,
        vehicleType: true,
        vehiclePlate: true,
        vehicleBrand: true,
        vehicleModel: true,
        vehicleYear: true,
        vehicleColor: true,
        averageRating: true,
        ratingCount: true,
        tripCountAsDriver: true,
        tripCountAsPassenger: true,
        totalEarned: true,
        totalSpent: true,
        walletBalance: true,
        lastLat: true,
        lastLng: true,
        lastLocationUpdatedAt: true,
        currentTripId: true,
        licenseExpiryDate: true,
        seguroExpiryDate: true,
        cedulaExpiryDate: true,
        rewardPoints: true,
        rewardLevel: true,
        createdAt: true,
      },
    });

    if (!driver) {
      return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });
    }

    // Trip history as driver — last 50
    const tripsAsDriver = await prisma.trip.findMany({
      where: { driverId: id, status: { in: ['completed', 'cancelled'] } },
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
        paymentMethod: true,
        userId: true,
        rating: true,
        acceptedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Flag trips with potential route manipulation
    const enrichedTrips = tripsAsDriver.map((t) => {
      const distanceKm = t.distance || 0;
      const durationMin = t.duration || 0;
      const expectedMin = distanceKm > 0 ? (distanceKm / 25) * 60 : 0;
      const isFlagged = expectedMin > 0 && durationMin > expectedMin * 1.5;
      return {
        ...t,
        routePoints: t.route ? parseRoute(t.route) : [],
        isFlagged,
        expectedDurationMin: Math.round(expectedMin),
      };
    });

    // Ratings received (as driver)
    const ratingsReceived = await prisma.rating.findMany({
      where: { toUserId: id, toRole: 'driver' },
      select: {
        id: true,
        stars: true,
        reason: true,
        comment: true,
        fromRole: true,
        createdAt: true,
        tripId: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Active trip (if any)
    let activeTrip = null;
    if (driver.currentTripId) {
      activeTrip = await prisma.trip.findUnique({
        where: { id: driver.currentTripId },
        select: {
          id: true,
          status: true,
          originName: true,
          destName: true,
          fare: true,
          acceptedAt: true,
          createdAt: true,
          userId: true,
        },
      });
    }

    return NextResponse.json({
      driver,
      tripsAsDriver: enrichedTrips,
      ratingsReceived,
      activeTrip,
    });
  } catch (error) {
    console.error('[ops/driver/[id]] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function parseRoute(route: string | null): [number, number][] {
  if (!route) return [];
  try {
    const parsed = JSON.parse(route);
    if (Array.isArray(parsed)) {
      return parsed
        .map((p: unknown) => {
          if (Array.isArray(p) && p.length >= 2) {
            return [Number(p[0]), Number(p[1])] as [number, number];
          }
          return null;
        })
        .filter((p): p is [number, number] => p !== null);
    }
  } catch {
    // Not valid JSON
  }
  return [];
}
