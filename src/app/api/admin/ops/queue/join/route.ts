import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adminUserId, driverId, locationId } = body;

    if (!adminUserId || !driverId || !locationId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify admin
    const admin = await prisma.user.findUnique({ where: { id: adminUserId } });
    if (!admin?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check driver exists
    const driver = await prisma.user.findUnique({
      where: { id: driverId },
      select: { id: true, name: true, isOnline: true },
    });
    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    // Check location exists and is active
    const location = await prisma.queueLocation.findUnique({
      where: { id: locationId },
    });
    if (!location || !location.isActive) {
      return NextResponse.json({ error: 'Location not found or inactive' }, { status: 404 });
    }

    // Check if driver is already in ANY queue
    const existingEntry = await prisma.queueEntry.findFirst({
      where: { driverId, status: 'waiting' },
    });
    if (existingEntry) {
      return NextResponse.json({ error: 'Driver already in a queue' }, { status: 409 });
    }

    // Check queue capacity
    const waitingCount = await prisma.queueEntry.count({
      where: { locationId, status: 'waiting' },
    });
    if (waitingCount >= location.maxQueueSize) {
      return NextResponse.json({ error: 'Queue is full' }, { status: 409 });
    }

    // Get the next position
    const maxPosition = await prisma.queueEntry.findFirst({
      where: { locationId, status: 'waiting' },
      select: { position: true },
      orderBy: { position: 'desc' },
    });
    const nextPosition = (maxPosition?.position ?? 0) + 1;

    // Estimate wait: ~3 min per position ahead
    const estimatedWait = Math.round(nextPosition * 3);

    // Create entry
    const entry = await prisma.queueEntry.create({
      data: {
        driverId,
        driverName: driver.name,
        locationId,
        locationName: location.name,
        position: nextPosition,
        estimatedWaitMinutes: estimatedWait,
      },
    });

    return NextResponse.json({ success: true, entry });
  } catch (error) {
    console.error('[ops/queue/join] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
