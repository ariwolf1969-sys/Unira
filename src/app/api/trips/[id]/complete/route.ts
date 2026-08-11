import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST: Complete a trip
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { driverId, actualDistance, actualDuration, route } = body;

    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    }

    // Update trip
    const updatedTrip = await prisma.trip.update({
      where: { id },
      data: {
        status: 'completed',
        distance: actualDistance ?? trip.distance,
        duration: actualDuration ?? trip.duration,
        route: route ? JSON.stringify(route) : trip.route,
      },
    });

    // Clear driver's active trip
    if (driverId) {
      await prisma.user.update({
        where: { id: driverId },
        data: { currentTripId: '' },
      });
    }

    // Update passenger stats
    await prisma.user.update({
      where: { id: trip.userId },
      data: {
        tripCountAsPassenger: { increment: 1 },
        totalSpent: { increment: trip.fare },
      },
    });

    // Update driver stats
    if (driverId) {
      await prisma.user.update({
        where: { id: driverId },
        data: {
          tripCountAsDriver: { increment: 1 },
          totalEarned: { increment: trip.fare },
        },
      });
    }

    // ── Server-side wallet handling ──
    // If payment method is 'wallet', atomically deduct from passenger and credit driver
    if (trip.paymentMethod === 'wallet' && trip.fare > 0) {
      // Deduct from passenger wallet
      const passenger = await prisma.user.findUnique({
        where: { id: trip.userId },
        select: { walletBalance: true },
      });
      if (passenger && passenger.walletBalance >= trip.fare) {
        await prisma.user.update({
          where: { id: trip.userId },
          data: {
            walletBalance: { decrement: trip.fare },
          },
        });
        // Log passenger wallet movement
        await prisma.walletMovement.create({
          data: {
            userId: trip.userId,
            type: 'ride',
            amount: -trip.fare,
            description: `Viaje ${id.slice(0, 8)}`,
            balance: (passenger.walletBalance - trip.fare),
          },
        });
      }

      // Credit driver wallet (cooperative commission: 5% socio, 8% non-socio)
      if (driverId) {
        const driver = await prisma.user.findUnique({
          where: { id: driverId },
          select: { walletBalance: true, isSocio: true },
        });
        if (driver) {
          const commission = driver.isSocio ? 0.05 : 0.08;
          const driverPayout = Math.round(trip.fare * (1 - commission));
          await prisma.user.update({
            where: { id: driverId },
            data: {
              walletBalance: { increment: driverPayout },
            },
          });
          // Log driver wallet movement
          await prisma.walletMovement.create({
            data: {
              userId: driverId,
              type: 'ride',
              amount: driverPayout,
              description: `Viaje ${id.slice(0, 8)} (comisión ${Math.round(commission * 100)}%)`,
              balance: (driver.walletBalance + driverPayout),
            },
          });
        }
      }
    }

    return NextResponse.json({ success: true, tripId: id });
  } catch (error: any) {
    console.error('Complete trip error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
