import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { haversineKm } from '@/lib/haversine';
import { notifyDriverNewTrip } from '@/lib/push';

// POST: Passenger creates a trip request (status='searching')
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      origin,
      destination,
      waypoints,
      fare,
      distance,
      duration,
      vehicleType,
      paymentMethod,
      route,
      thirdParty,
      thirdPartyPhoto,
    } = body;

    if (!userId || !origin || !destination || !fare) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    // Generate 4-digit verification code
    const verificationCode = String(Math.floor(1000 + Math.random() * 9000));

    // Expires in 5 minutes (allows more time for real driver matching)
    const expiresAt = new Date(Date.now() + 300_000).toISOString();

    // Create trip with status 'searching'
    const trip = await prisma.trip.create({
      data: {
        userId,
        passengerId: userId,
        status: 'searching',
        type: 'ride',
        originName: origin.name || '',
        originAddress: origin.address || '',
        originLat: origin.lat || 0,
        originLng: origin.lng || 0,
        destName: destination.name || '',
        destAddress: destination.address || '',
        destLat: destination.lat || 0,
        destLng: destination.lng || 0,
        fare,
        distance: distance ?? null,
        duration: duration ?? null,
        vehicleType: vehicleType || 'auto',
        requestedVehicleType: vehicleType || '',
        paymentMethod: paymentMethod || '',
        verificationCode,
        expiresAt,
        waypoints: waypoints ? JSON.stringify(waypoints) : null,
        route: route ? JSON.stringify(route) : null,
        routePolyline: route ? JSON.stringify(route) : '',
        driverNotifiedIds: '[]',
        rejectedByDriverIds: '[]',
        thirdParty: thirdParty || null,
        thirdPartyPhoto: thirdPartyPhoto || null,
      },
    });

    // ── Find nearby eligible drivers ──
    const onlineDrivers = await prisma.user.findMany({
      where: {
        isOnline: true,
        isDriverApproved: true,
        isDriver: true,
      },
      select: {
        id: true,
        lastLat: true,
        lastLng: true,
        vehicleType: true,
      },
    });

    // Get driver configs for filtering
    const driverIds = onlineDrivers.map((d) => d.id);
    const configs = driverIds.length > 0
      ? await prisma.driverConfig.findMany({
          where: { userId: { in: driverIds } },
          select: {
            userId: true,
            maxPickupKm: true,
            minFare: true,
            minPerKm: true,
            genderPreference: true,
            driverGender: true,
            acceptedPaymentMethods: true,
          },
        })
      : [];
    const configMap = new Map(configs.map((c) => [c.userId, c]));

    // Get passenger info for gender matching
    const passenger = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, gender: true },
    });

    // Find eligible drivers within range
    const eligibleDrivers: string[] = [];
    for (const driver of onlineDrivers) {
      if (!driver.lastLat || !driver.lastLng) continue;

      const distToPickup = haversineKm(origin.lat, origin.lng, driver.lastLat, driver.lastLng);
      const config = configMap.get(driver.id);

      const maxPickup = config?.maxPickupKm ?? 10;
      if (distToPickup > maxPickup) continue;

      // Min fare check
      if (config?.minFare && fare < config.minFare) continue;

      // Min per km check
      if (config?.minPerKm && distance > 0 && fare / distance < config.minPerKm) continue;

      // Gender preference check (driver's preference for passenger gender)
      // Note: User model doesn't have a gender field yet, skip this for now
      // if (config?.genderPreference && config.genderPreference !== 'any') { ... }

      // Payment method check
      if (config?.acceptedPaymentMethods && paymentMethod) {
        const accepted: string[] = JSON.parse(config.acceptedPaymentMethods);
        if (accepted.length > 0 && !accepted.includes(paymentMethod)) continue;
      }

      // Vehicle type matching
      // Skip drivers whose vehicle type doesn't match the request (auto = universal)
      if (vehicleType && vehicleType !== 'auto' && driver.vehicleType && driver.vehicleType !== vehicleType) continue;

      eligibleDrivers.push(driver.id);
      if (eligibleDrivers.length >= 5) break; // Notify up to 5 drivers
    }

    // Mark notified drivers on the trip
    if (eligibleDrivers.length > 0) {
      await prisma.trip.update({
        where: { id: trip.id },
        data: { driverNotifiedIds: JSON.stringify(eligibleDrivers) },
      });

      // ── Send push notifications to eligible drivers ──
      // Fetch their push tokens and send notifications (fire-and-forget)
      const driversWithTokens = await prisma.user.findMany({
        where: { id: { in: eligibleDrivers } },
        select: { id: true, pushToken: true },
      });
      for (const d of driversWithTokens) {
        if (d.pushToken) {
          notifyDriverNewTrip(d.pushToken, {
            tripId: trip.id,
            pickup: origin.name || '',
            destination: destination.name || '',
            fare,
          }).catch(() => {}); // fire-and-forget
        }
      }
    }

    return NextResponse.json({
      trip: { id: trip.id, verificationCode },
      notifiedDriverCount: eligibleDrivers.length,
    });
  } catch (error: any) {
    console.error('Trip request error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
