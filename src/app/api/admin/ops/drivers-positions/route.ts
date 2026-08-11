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

    // Fetch all online drivers with their positions and current trip info
    const drivers = await prisma.user.findMany({
      where: {
        isDriver: true,
        isOnline: true,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        vehicleType: true,
        vehiclePlate: true,
        vehicleBrand: true,
        vehicleModel: true,
        vehicleColor: true,
        averageRating: true,
        ratingCount: true,
        lastLat: true,
        lastLng: true,
        lastLocationUpdatedAt: true,
        currentTripId: true,
        isDriverApproved: true,
      },
      orderBy: { name: 'asc' },
    });

    // Enrich with current trip data for drivers who have active trips
    const driverIdsWithTrips = drivers
      .filter((d) => d.currentTripId && d.currentTripId !== '')
      .map((d) => d.currentTripId);

    const activeTrips = driverIdsWithTrips.length > 0
      ? await prisma.trip.findMany({
          where: { id: { in: driverIdsWithTrips } },
          select: {
            id: true,
            status: true,
            originName: true,
            destName: true,
            originLat: true,
            originLng: true,
            destLat: true,
            destLng: true,
            passengerId: true,
            fare: true,
            currentLat: true,
            currentLng: true,
            locationUpdatedAt: true,
          },
        })
      : [];

    const tripMap = new Map(activeTrips.map((t) => [t.id, t]));

    const enrichedDrivers = drivers.map((d) => {
      const trip = d.currentTripId ? tripMap.get(d.currentTripId) : null;
      // Determine status: 'available' if no trip, 'in-trip' if trip in_progress, 'idle' otherwise
      let status: 'available' | 'in-trip' | 'idle';
      if (trip && trip.status === 'in_progress') {
        status = 'in-trip';
      } else if (trip && (trip.status === 'accepted' || trip.status === 'searching')) {
        status = 'idle';
      } else {
        status = 'available';
      }

      // For in-trip drivers, prefer trip-level GPS (updated every 3s)
      // over user-level GPS (updated at variable watchPosition intervals)
      let effectiveLat = d.lastLat;
      let effectiveLng = d.lastLng;
      let effectiveUpdatedAt = d.lastLocationUpdatedAt;
      if (status === 'in-trip' && trip?.currentLat && trip?.currentLng && trip?.locationUpdatedAt) {
        const tripTime = new Date(trip.locationUpdatedAt).getTime();
        const userTime = d.lastLocationUpdatedAt ? new Date(d.lastLocationUpdatedAt).getTime() : 0;
        if (tripTime > userTime) {
          effectiveLat = trip.currentLat;
          effectiveLng = trip.currentLng;
          effectiveUpdatedAt = trip.locationUpdatedAt.toISOString();
        }
      }

      return {
        ...d,
        lastLat: effectiveLat,
        lastLng: effectiveLng,
        lastLocationUpdatedAt: effectiveUpdatedAt,
        status,
        currentTrip: trip ? {
          id: trip.id,
          status: trip.status,
          originName: trip.originName,
          destName: trip.destName,
          originLat: trip.originLat,
          originLng: trip.originLng,
          destLat: trip.destLat,
          destLng: trip.destLng,
          fare: trip.fare,
        } : null,
      };
    });

    return NextResponse.json({ drivers: enrichedDrivers });
  } catch (error) {
    console.error('[ops/drivers-positions] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
