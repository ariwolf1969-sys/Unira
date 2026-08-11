import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { haversineKm } from '@/lib/haversine';

// GET: Poll pending trip requests for a driver
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: driverId } = await params;

    // Get driver info
    const driver = await prisma.user.findUnique({
      where: { id: driverId },
      select: { lastLat: true, lastLng: true, currentTripId: true, vehicleType: true },
    });

    if (!driver) {
      return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });
    }

    // If driver has active trip, return it
    if (driver.currentTripId && driver.currentTripId !== '') {
      const activeTrip = await prisma.trip.findUnique({ where: { id: driver.currentTripId } });
      if (activeTrip && (activeTrip.status === 'accepted' || activeTrip.status === 'in_progress')) {
        const passenger = await prisma.user.findUnique({
          where: { id: activeTrip.userId },
          select: { name: true, averageRating: true, ratingCount: true, tripCountAsPassenger: true, phone: true, facePhoto: true },
        });
        return NextResponse.json({
          activeTrip: {
            id: activeTrip.id,
            status: activeTrip.status,
            fare: activeTrip.fare,
            distance: activeTrip.distance,
            duration: activeTrip.duration,
            verificationCode: activeTrip.verificationCode,
            origin: { name: activeTrip.originName, address: activeTrip.originAddress, lat: activeTrip.originLat, lng: activeTrip.originLng },
            destination: { name: activeTrip.destName, address: activeTrip.destAddress, lat: activeTrip.destLat, lng: activeTrip.destLng },
            passenger: passenger ? {
              name: passenger.name,
              rating: passenger.averageRating,
              ratingCount: passenger.ratingCount,
              tripCount: passenger.tripCountAsPassenger,
              phoneLast4: passenger.phone ? passenger.phone.slice(-4) : '',
              facePhoto: passenger.facePhoto || '',
              thirdParty: activeTrip.thirdParty || null,
              thirdPartyPhoto: activeTrip.thirdPartyPhoto || null,
            } : null,
            acceptedAt: activeTrip.acceptedAt,
          },
          pendingRequests: [],
        });
      }
    }

    // Get driver config for filtering
    const config = await prisma.driverConfig.findUnique({
      where: { userId: driverId },
    });

    const maxPickupKm = config?.maxPickupKm ?? 10;

    // Find active searching trips not expired
    const now = new Date();
    const activeTrips = await prisma.trip.findMany({
      where: {
        status: 'searching',
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    // Filter: within driver's pickup radius and not rejected by this driver
    const pending = activeTrips
      .filter((trip) => {
        // Check driver hasn't already rejected
        const rejected: string[] = JSON.parse(trip.rejectedByDriverIds || '[]');
        if (rejected.includes(driverId)) return false;

        // Check distance from driver to pickup
        if (driver.lastLat && driver.lastLng) {
          const dist = haversineKm(trip.originLat, trip.originLng, driver.lastLat, driver.lastLng);
          if (dist > maxPickupKm) return false;
        }

        return true;
      })
      .map((trip) => {
        const expiresMs = trip.expiresAt ? new Date(trip.expiresAt).getTime() : 0;
        const remainingSec = Math.max(0, Math.round((expiresMs - Date.now()) / 1000));
        const distToPickup = driver.lastLat && driver.lastLng
          ? haversineKm(trip.originLat, trip.originLng, driver.lastLat, driver.lastLng)
          : 0;

        return {
          id: trip.id,
          pickup: trip.originName,
          pickupAddress: trip.originAddress,
          pickupLat: trip.originLat,
          pickupLng: trip.originLng,
          destination: trip.destName,
          destinationAddress: trip.destAddress,
          destinationLat: trip.destLat,
          destinationLng: trip.destLng,
          fare: trip.fare,
          distance: trip.distance,
          duration: trip.duration,
          requestedVehicleType: trip.requestedVehicleType,
          paymentMethod: trip.paymentMethod,
          createdAt: trip.createdAt.toISOString(),
          remainingSec,
          distToPickupKm: Math.round(distToPickup * 10) / 10,
          // Passenger info (anonymous-ish)
          passengerName: trip.userId ? trip.userId.slice(0, 6) : 'Pasajero',
        };
      })
      .filter((r) => r.remainingSec > 0);

    return NextResponse.json({
      activeTrip: null,
      pendingRequests: pending,
    });
  } catch (error: any) {
    console.error('Driver requests error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
