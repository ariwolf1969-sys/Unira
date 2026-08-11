import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { haversineKm } from '@/lib/haversine';

// POST: Driver declines a trip
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

    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip || trip.status !== 'searching') {
      return NextResponse.json({ error: 'Viaje no disponible' }, { status: 404 });
    }

    // Add driver to rejected list
    const rejected: string[] = JSON.parse(trip.rejectedByDriverIds || '[]');
    if (!rejected.includes(driverId)) {
      rejected.push(driverId);
    }

    await prisma.trip.update({
      where: { id },
      data: { rejectedByDriverIds: JSON.stringify(rejected) },
    });

    // Try cascade: find next eligible driver not yet notified/rejected
    const notified: string[] = JSON.parse(trip.driverNotifiedIds || '[]');
    const allRejected = new Set(rejected);

    // Find more drivers to notify (excluding already notified + rejected)
    const onlineDrivers = await prisma.user.findMany({
      where: {
        isOnline: true,
        isDriverApproved: true,
        isDriver: true,
        id: { notIn: [...notified, ...rejected] },
      },
      select: { id: true, lastLat: true, lastLng: true },
      take: 2,
    });

    const newNotified: string[] = [];
    for (const driver of onlineDrivers) {
      if (!driver.lastLat || !driver.lastLng) continue;
      const dist = haversineKm(trip.originLat, trip.originLng, driver.lastLat, driver.lastLng);
      if (dist <= 10) {
        newNotified.push(driver.id);
      }
    }

    if (newNotified.length > 0) {
      const updatedNotified = [...notified, ...newNotified];
      await prisma.trip.update({
        where: { id },
        data: { driverNotifiedIds: JSON.stringify(updatedNotified) },
      });
    }

    // Check if all options exhausted
    const totalAttempted = notified.length + rejected.length;
    const exhausted = newNotified.length === 0 && totalAttempted > 0;

    return NextResponse.json({
      success: true,
      newNotifiedCount: newNotified.length,
      exhausted,
    });
  } catch (error: any) {
    console.error('Decline trip error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
