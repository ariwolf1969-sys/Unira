import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET: Poll trip status (used by both passenger and driver)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role'); // 'passenger' | 'driver'

    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    }

    const base = {
      id: trip.id,
      status: trip.status,
      fare: trip.fare,
      distance: trip.distance,
      duration: trip.duration,
      verificationCode: trip.verificationCode,
      paymentMethod: trip.paymentMethod,
    };

    // If expired and still searching
    if (trip.status === 'searching' && trip.expiresAt && new Date(trip.expiresAt) < new Date()) {
      return NextResponse.json({
        ...base,
        status: 'expired',
        message: 'La solicitud expiró sin conductor disponible',
      });
    }

    // Passenger view: return driver info if accepted
    if (role === 'passenger' && (trip.status === 'accepted' || trip.status === 'in_progress')) {
      // Fetch driver's communication preference
      let communicationPreference = 'both';
      let driverPhone = '';
      if (trip.driverId) {
        try {
          const [driverInfo, driverCfg] = await Promise.all([
            prisma.user.findUnique({ where: { id: trip.driverId }, select: { phone: true } }),
            prisma.driverConfig.findUnique({ where: { userId: trip.driverId }, select: { communicationPreference: true } }),
          ]);
          if (driverInfo?.phone) driverPhone = driverInfo.phone;
          if (driverCfg?.communicationPreference) communicationPreference = driverCfg.communicationPreference;
        } catch { /* ignore */ }
      }
      return NextResponse.json({
        ...base,
        driver: {
          id: trip.driverId,
          name: trip.driverName,
          photo: trip.driverPhoto,
          vehicle: trip.driverVehicle,
          currentLat: trip.currentLat,
          currentLng: trip.currentLng,
          heading: trip.currentHeading,
          speed: trip.currentSpeed,
          locationUpdatedAt: trip.locationUpdatedAt,
          phone: driverPhone,
          communicationPreference,
        },
        origin: { name: trip.originName, lat: trip.originLat, lng: trip.originLng },
        destination: { name: trip.destName, lat: trip.destLat, lng: trip.destLng },
      });
    }

    // Driver view: return passenger info if accepted
    if (role === 'driver' && (trip.status === 'accepted' || trip.status === 'in_progress')) {
      const passenger = await prisma.user.findUnique({
        where: { id: trip.userId },
        select: { name: true, averageRating: true, ratingCount: true, tripCountAsPassenger: true, phone: true, avatar: true, facePhoto: true },
      });
      return NextResponse.json({
        ...base,
        passenger: passenger ? {
          id: trip.userId,
          name: passenger.name,
          rating: passenger.averageRating,
          ratingCount: passenger.ratingCount,
          tripCount: passenger.tripCountAsPassenger,
          phone: passenger.phone || '',
          phoneLast4: passenger.phone ? passenger.phone.slice(-4) : '',
          avatar: passenger.avatar,
          facePhoto: passenger.facePhoto || '',
          thirdParty: trip.thirdParty || null,
          thirdPartyPhoto: trip.thirdPartyPhoto || null,
        } : null,
        origin: { name: trip.originName, address: trip.originAddress, lat: trip.originLat, lng: trip.originLng },
        destination: { name: trip.destName, address: trip.destAddress, lat: trip.destLat, lng: trip.destLng },
      });
    }

    // Searching or other statuses
    return NextResponse.json(base);
  } catch (error: any) {
    console.error('Trip status error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
