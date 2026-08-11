import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adminUserId, locationId, tripId } = body;

    if (!adminUserId || !locationId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify admin
    const admin = await prisma.user.findUnique({ where: { id: adminUserId } });
    if (!admin?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the first driver in queue (lowest position)
    const firstInQueue = await prisma.queueEntry.findFirst({
      where: { locationId, status: 'waiting' },
      orderBy: { position: 'asc' },
    });

    if (!firstInQueue) {
      return NextResponse.json({ error: 'Queue is empty' }, { status: 404 });
    }

    // Mark the entry as assigned
    const now = new Date();
    await prisma.queueEntry.update({
      where: { id: firstInQueue.id },
      data: { status: 'assigned', assignedAt: now },
    });

    // If a tripId was provided, assign the driver to it
    if (tripId) {
      const trip = await prisma.trip.findUnique({ where: { id: tripId } });
      if (trip) {
        await prisma.trip.update({
          where: { id: tripId },
          data: {
            driverId: firstInQueue.driverId,
            driverName: firstInQueue.driverName,
            status: 'accepted',
            acceptedAt: now,
          },
        });

        // Update driver's currentTripId
        await prisma.user.update({
          where: { id: firstInQueue.driverId },
          data: { currentTripId: tripId },
        });
      }
    }

    // Reposition remaining entries
    const remainingEntries = await prisma.queueEntry.findMany({
      where: { locationId, status: 'waiting' },
      orderBy: { joinedAt: 'asc' },
    });

    for (let i = 0; i < remainingEntries.length; i++) {
      const newPos = i + 1;
      const estWait = newPos * 3;
      await prisma.queueEntry.update({
        where: { id: remainingEntries[i].id },
        data: { position: newPos, estimatedWaitMinutes: estWait },
      });
    }

    return NextResponse.json({
      success: true,
      assignedDriver: {
        id: firstInQueue.id,
        driverId: firstInQueue.driverId,
        driverName: firstInQueue.driverName,
      },
      tripId: tripId || null,
    });
  } catch (error) {
    console.error('[ops/queue/assign] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
