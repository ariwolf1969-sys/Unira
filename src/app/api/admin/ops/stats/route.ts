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

    const now = new Date();
    const since24h = new Date();
    since24h.setHours(since24h.getHours() - 24);

    // Total online drivers
    const onlineDrivers = await prisma.user.count({
      where: { isDriver: true, isOnline: true },
    });

    // Active trips (in_progress)
    const activeTrips = await prisma.trip.count({
      where: { status: 'in_progress' },
    });

    // Pending trip requests (searching, not expired)
    const pendingRequests = await prisma.trip.count({
      where: {
        status: 'searching',
        expiresAt: { gt: now },
      },
    });

    // Trips in last 24h
    const trips24h = await prisma.trip.findMany({
      where: { createdAt: { gte: since24h }, status: 'completed' },
      select: { duration: true, fare: true, createdAt: true, originLat: true, originLng: true },
    });

    // Average wait time (time from createdAt to acceptedAt for completed trips)
    const acceptedTrips = await prisma.trip.findMany({
      where: {
        createdAt: { gte: since24h },
        status: 'completed',
        acceptedAt: { not: null },
      },
      select: { createdAt: true, acceptedAt: true },
    });

    let avgWaitSeconds = 0;
    if (acceptedTrips.length > 0) {
      const totalWait = acceptedTrips.reduce((sum, t) => {
        if (t.acceptedAt) {
          return sum + (t.acceptedAt.getTime() - t.createdAt.getTime()) / 1000;
        }
        return sum;
      }, 0);
      avgWaitSeconds = Math.round(totalWait / acceptedTrips.length);
    }

    // Average fare
    const avgFare = trips24h.length > 0
      ? Math.round(trips24h.reduce((s, t) => s + t.fare, 0) / trips24h.length)
      : 0;

    // Total revenue
    const totalRevenue = trips24h.reduce((s, t) => s + t.fare, 0);

    // Queue status per location
    const queueLocations = await prisma.queueLocation.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        entries: {
          where: { status: 'waiting' },
          select: { id: true, position: true, joinedAt: true },
          orderBy: { position: 'asc' },
        },
      },
    });

    const queueStatus = queueLocations.map((loc) => ({
      id: loc.id,
      name: loc.name,
      count: loc.entries.length,
    }));

    // Heat map data: last 24h trip origins
    const heatData = trips24h.map((t) => ({
      lat: t.originLat,
      lng: t.originLng,
      intensity: 1,
    }));

    // Active SOS alerts
    const activeSosAlerts = await prisma.sosAlert.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        userId: true,
        tripId: true,
        shareToken: true,
        lat: true,
        lng: true,
        createdAt: true,
      },
    });

    // Hydrate SOS user info
    const sosUserIds = [...new Set(activeSosAlerts.map(a => a.userId))];
    const sosUsers = sosUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: sosUserIds } },
          select: { id: true, name: true, phone: true, isDriver: true },
        })
      : [];
    const sosUserMap = new Map(sosUsers.map(u => [u.id, u]));

    const sosAlerts = activeSosAlerts.map(a => ({
      ...a,
      user: sosUserMap.get(a.userId) || null,
    }));

    // Pending trip requests with details
    const pendingTrips = await prisma.trip.findMany({
      where: {
        status: 'searching',
        expiresAt: { gt: now },
      },
      select: {
        id: true,
        originName: true,
        destName: true,
        originLat: true,
        originLng: true,
        destLat: true,
        destLng: true,
        requestedVehicleType: true,
        createdAt: true,
        userId: true,
        fare: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      onlineDrivers,
      activeTrips,
      pendingRequests,
      avgWaitSeconds,
      avgFare,
      totalRevenue,
      completedTrips24h: trips24h.length,
      queueStatus,
      heatData,
      pendingTrips,
      activeSosCount: activeSosAlerts.length,
      sosAlerts,
    });
  } catch (error) {
    console.error('[ops/stats] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
