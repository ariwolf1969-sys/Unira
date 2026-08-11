import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { notifyPassengerTripAccepted } from '@/lib/push';

// POST: Driver accepts a trip
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { driverId } = body;

    if (!driverId) {
      return NextResponse.json({ error: 'driverId requerido' }, { status: 400 });
    }

    // Get trip
    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    }
    if (trip.status !== 'searching') {
      return NextResponse.json({ error: 'Viaje ya no está disponible' }, { status: 409 });
    }
    if (trip.expiresAt && new Date(trip.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Solicitud expirada' }, { status: 410 });
    }

    // Get driver info
    const driver = await prisma.user.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        name: true,
        averageRating: true,
        ratingCount: true,
        vehicleBrand: true,
        vehicleModel: true,
        vehicleColor: true,
        vehiclePlate: true,
        vehicleType: true,
        avatar: true,
        phone: true,
      },
    });

    if (!driver) {
      return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });
    }

    // Get passenger info
    const passenger = await prisma.user.findUnique({
      where: { id: trip.userId },
      select: {
        name: true,
        averageRating: true,
        ratingCount: true,
        tripCountAsPassenger: true,
        phone: true,
        avatar: true,
        facePhoto: true,
      },
    });

    // Accept trip
    const updatedTrip = await prisma.trip.update({
      where: { id },
      data: {
        status: 'accepted',
        driverId: driver.id,
        driverName: driver.name,
        driverPhoto: driver.avatar || '',
        driverVehicle: `${driver.vehicleBrand || ''} ${driver.vehicleModel || ''} ${driver.vehicleColor || ''}`.trim(),
        acceptedAt: new Date().toISOString(),
      },
    });

    // Set driver's currentTripId
    await prisma.user.update({
      where: { id: driverId },
      data: { currentTripId: id },
    });

    // ── Push notification to passenger ──
    const passengerUser = await prisma.user.findUnique({
      where: { id: trip.userId },
      select: { pushToken: true },
    });
    if (passengerUser?.pushToken) {
      notifyPassengerTripAccepted(passengerUser.pushToken, {
        tripId: id,
        driverName: driver.name,
        vehicle: `${driver.vehicleBrand || ''} ${driver.vehicleModel || ''}`.trim(),
        plate: driver.vehiclePlate || '',
        eta: '5 min',
      }).catch(() => {}); // fire-and-forget
    }

    return NextResponse.json({
      trip: {
        id: updatedTrip.id,
        status: updatedTrip.status,
        fare: updatedTrip.fare,
        distance: updatedTrip.distance,
        duration: updatedTrip.duration,
        verificationCode: updatedTrip.verificationCode,
        origin: { name: updatedTrip.originName, lat: updatedTrip.originLat, lng: updatedTrip.originLng },
        destination: { name: updatedTrip.destName, lat: updatedTrip.destLat, lng: updatedTrip.destLng },
      },
      driver: {
        id: driver.id,
        name: driver.name,
        rating: driver.averageRating,
        ratingCount: driver.ratingCount,
        vehicle: `${driver.vehicleBrand || ''} ${driver.vehicleModel || ''}`.trim(),
        plate: driver.vehiclePlate,
        color: driver.vehicleColor,
        photo: driver.avatar || '',
      },
      passenger: passenger ? {
        id: trip.userId,
        name: passenger.name,
        rating: passenger.averageRating,
        ratingCount: passenger.ratingCount,
        tripCount: passenger.tripCountAsPassenger,
        phoneLast4: passenger.phone ? passenger.phone.slice(-4) : '',
        facePhoto: passenger.facePhoto || '',
      } : null,
    });
  } catch (error: any) {
    console.error('Accept trip error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
