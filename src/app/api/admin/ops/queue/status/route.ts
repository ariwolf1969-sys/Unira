import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const adminUserId = searchParams.get('adminUserId');

    if (!adminUserId) {
      return NextResponse.json({ error: 'Missing adminUserId' }, { status: 400 });
    }

    // Verify admin
    const admin = await prisma.user.findUnique({ where: { id: adminUserId } });
    if (!admin?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all queue locations with their waiting entries
    const locations = await prisma.queueLocation.findMany({
      where: { isActive: true },
      include: {
        entries: {
          where: { status: 'waiting' },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    const queueData = locations.map((loc) => ({
      id: loc.id,
      name: loc.name,
      address: loc.address,
      lat: loc.lat,
      lng: loc.lng,
      maxQueueSize: loc.maxQueueSize,
      drivers: loc.entries.map((e) => ({
        id: e.id,
        driverId: e.driverId,
        driverName: e.driverName,
        position: e.position,
        joinedAt: e.joinedAt.toISOString(),
        estimatedWaitMinutes: e.estimatedWaitMinutes,
      })),
    }));

    return NextResponse.json({ queues: queueData });
  } catch (error) {
    console.error('[ops/queue/status] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
