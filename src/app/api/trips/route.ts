import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId es requerido' },
        { status: 400 }
      );
    }

    const trips = await prisma.trip.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Convert from flat DB format to client Trip format
    const formattedTrips = trips.map((trip) => ({
      id: trip.id,
      type: trip.type as 'ride' | 'food' | 'send',
      status: trip.status as 'completed' | 'cancelled',
      origin: {
        name: trip.originName,
        address: trip.originAddress,
        lat: trip.originLat,
        lng: trip.originLng,
      },
      destination: {
        name: trip.destName,
        address: trip.destAddress,
        lat: trip.destLat,
        lng: trip.destLng,
      },
      fare: trip.fare,
      vehicleType: trip.vehicleType || 'auto',
      driverId: trip.driverId || undefined,
      driverName: trip.driverName || undefined,
      driverPhoto: trip.driverPhoto || undefined,
      driverVehicle: trip.driverVehicle || undefined,
      rating: trip.rating ?? undefined,
      thirdParty: trip.thirdParty || undefined,
      thirdPhone: trip.thirdPhone || undefined,
      distance: trip.distance ?? undefined,
      duration: trip.duration ?? undefined,
      waypoints: trip.waypoints ? JSON.parse(trip.waypoints) : undefined,
      createdAt: trip.createdAt.toISOString(),
    }));

    return NextResponse.json({ trips: formattedTrips });
  } catch (error) {
    console.error('Get trips error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, trip } = body;

    if (!userId || !trip) {
      return NextResponse.json(
        { error: 'userId y trip son requeridos' },
        { status: 400 }
      );
    }

    const createdTrip = await prisma.trip.create({
      data: {
        userId,
        type: trip.type || 'ride',
        status: trip.status || 'completed',
        originName: trip.origin?.name || '',
        originAddress: trip.origin?.address || '',
        originLat: trip.origin?.lat || 0,
        originLng: trip.origin?.lng || 0,
        destName: trip.destination?.name || '',
        destAddress: trip.destination?.address || '',
        destLat: trip.destination?.lat || 0,
        destLng: trip.destination?.lng || 0,
        fare: trip.fare || 0,
        vehicleType: trip.vehicleType || 'auto',
        driverId: trip.driverId || null,
        driverName: trip.driverName || null,
        driverPhoto: trip.driverPhoto || null,
        driverVehicle: trip.driverVehicle || null,
        rating: trip.rating ?? null,
        thirdParty: trip.thirdParty || null,
        thirdPhone: trip.thirdPhone || null,
        distance: trip.distance ?? null,
        duration: trip.duration ?? null,
        waypoints: trip.waypoints ? JSON.stringify(trip.waypoints) : null,
      },
    });

    return NextResponse.json({ trip: { id: createdTrip.id } });
  } catch (error) {
    console.error('Create trip error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
