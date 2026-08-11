import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { haversineKm } from '@/lib/haversine';

// POST: Toggle driver online/offline + update location
// GET: Find nearby online drivers
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, online, lat, lng, heading } = body;

    if (!userId || online === undefined) {
      return NextResponse.json({ error: 'userId y online son requeridos' }, { status: 400 });
    }

    if (online) {
      // Go online + update location
      await prisma.user.update({
        where: { id: userId },
        data: {
          isOnline: true,
          lastLat: lat ?? null,
          lastLng: lng ?? null,
          lastLocationUpdatedAt: new Date().toISOString(),
          heading: heading ?? 0,
        },
      });
      return NextResponse.json({ success: true, online: true });
    } else {
      // Go offline — clear trip only if no active trip
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { currentTripId: true } });
      const hasActiveTrip = user?.currentTripId && user.currentTripId !== '';

      await prisma.user.update({
        where: { id: userId },
        data: {
          isOnline: false,
          ...(hasActiveTrip ? {} : { currentTripId: '' }),
        },
      });
      return NextResponse.json({ success: true, online: false });
    }
  } catch (error: any) {
    console.error('Driver status error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');
    const radiusKm = parseFloat(searchParams.get('radiusKm') || '10');
    const vehicleType = searchParams.get('vehicleType') || '';

    if (!lat || !lng) {
      return NextResponse.json({ error: 'lat y lng son requeridos' }, { status: 400 });
    }

    // Fetch all online approved drivers
    const drivers = await prisma.user.findMany({
      where: {
        isOnline: true,
        isDriverApproved: true,
        isDriver: true,
      },
      select: {
        id: true,
        name: true,
        averageRating: true,
        ratingCount: true,
        vehicleType: true,
        vehicleBrand: true,
        vehicleModel: true,
        vehicleColor: true,
        vehiclePlate: true,
        lastLat: true,
        lastLng: true,
        heading: true,
        avatar: true,
      },
    });

    // Filter by distance and vehicle type
    const nearby = drivers
      .filter((d) => {
        if (!d.lastLat || !d.lastLng) return false;
        const dist = haversineKm(lat, lng, d.lastLat, d.lastLng);
        return dist <= radiusKm;
      })
      .filter((d) => {
        if (!vehicleType) return true;
        return d.vehicleType === vehicleType;
      })
      .map((d) => ({
        ...d,
        distanceKm: haversineKm(lat, lng, d.lastLat!, d.lastLng!),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return NextResponse.json({ drivers: nearby });
  } catch (error: any) {
    console.error('Find drivers error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
