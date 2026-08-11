import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { haversineKm } from '@/lib/haversine';
import { notifyDriverNewTrip } from '@/lib/push';

// POST: Retry finding drivers for an expired trip (expanded search)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { expandRadiusMultiplier } = body;

    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    }

    // Only allow retry on expired/searching trips
    if (trip.status !== 'searching') {
      return NextResponse.json({ error: 'Viaje no esta en busqueda' }, { status: 400 });
    }

    const multiplier = expandRadiusMultiplier || 2;

    // Get already-notified drivers to avoid re-notifying
    const alreadyNotified: string[] = JSON.parse(trip.driverNotifiedIds || '[]');
    const alreadyRejected: string[] = JSON.parse(trip.rejectedByDriverIds || '[]');

    // Extend expiry by 2 more minutes
    const newExpiresAt = new Date(Date.now() + 120_000).toISOString();

    // Find new eligible drivers with expanded radius
    const onlineDrivers = await prisma.user.findMany({
      where: {
        isOnline: true,
        isDriverApproved: true,
        isDriver: true,
        id: { notIn: [...alreadyNotified, ...alreadyRejected] },
      },
      select: { id: true, lastLat: true, lastLng: true, vehicleType: true },
    });

    const driverIds = onlineDrivers.map((d) => d.id);
    const configs = driverIds.length > 0
      ? await prisma.driverConfig.findMany({
          where: { userId: { in: driverIds } },
          select: { userId: true, maxPickupKm: true, minFare: true, minPerKm: true, acceptedPaymentMethods: true },
        })
      : [];
    const configMap = new Map(configs.map((c) => [c.userId, c]));

    const newEligibleDrivers: string[] = [];
    for (const driver of onlineDrivers) {
      if (!driver.lastLat || !driver.lastLng) continue;
      const distToPickup = haversineKm(trip.originLat, trip.originLng, driver.lastLat, driver.lastLng);
      const maxPickup = (configMap.get(driver.id)?.maxPickupKm ?? 10) * multiplier;
      if (distToPickup > maxPickup) continue;
      if (configMap.get(driver.id)?.minFare && trip.fare < configMap.get(driver.id)!.minFare) continue;
      if (trip.requestedVehicleType && trip.requestedVehicleType !== 'auto' && driver.vehicleType && driver.vehicleType !== trip.requestedVehicleType) continue;
      if (configMap.get(driver.id)?.acceptedPaymentMethods && trip.paymentMethod) {
        const accepted: string[] = JSON.parse(configMap.get(driver.id)!.acceptedPaymentMethods);
        if (accepted.length > 0 && !accepted.includes(trip.paymentMethod)) continue;
      }
      newEligibleDrivers.push(driver.id);
      if (newEligibleDrivers.length >= 5) break;
    }

    // Update trip with new notified drivers and extended expiry
    const allNotified = [...alreadyNotified, ...newEligibleDrivers];
    await prisma.trip.update({
      where: { id },
      data: {
        driverNotifiedIds: JSON.stringify(allNotified),
        expiresAt: newExpiresAt,
      },
    });

    // Send push notifications to new drivers
    if (newEligibleDrivers.length > 0) {
      const driversWithTokens = await prisma.user.findMany({
        where: { id: { in: newEligibleDrivers } },
        select: { id: true, pushToken: true },
      });
      for (const d of driversWithTokens) {
        if (d.pushToken) {
          notifyDriverNewTrip(d.pushToken, {
            tripId: trip.id,
            pickup: trip.originName || '',
            destination: trip.destName || '',
            fare: trip.fare,
          }).catch(() => {});
        }
      }
    }

    return NextResponse.json({
      success: true,
      newNotifiedCount: newEligibleDrivers.length,
      totalNotified: allNotified.length,
      expiresAt: newExpiresAt,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Retry search error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
