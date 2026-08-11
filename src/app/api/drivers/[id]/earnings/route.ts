import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET: Driver earnings dashboard data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get driver info
    const driver = await prisma.user.findUnique({
      where: { id },
      select: {
        isSocio: true,
        walletBalance: true,
        totalEarned: true,
        tripCountAsDriver: true,
        vehicleType: true,
        vehiclePlate: true,
      },
    });

    if (!driver) {
      return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });
    }

    const commission = driver.isSocio ? 0.05 : 0.08;
    const commissionLabel = driver.isSocio ? '5%' : '8%';

    // Get completed trips as driver
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const allTrips = await prisma.trip.findMany({
      where: {
        driverId: id,
        status: 'completed',
      },
      select: {
        id: true,
        fare: true,
        distance: true,
        duration: true,
        originName: true,
        destName: true,
        paymentMethod: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate periods
    const todayTrips = allTrips.filter(t => new Date(t.createdAt) >= startOfDay);
    const weekTrips = allTrips.filter(t => new Date(t.createdAt) >= startOfWeek);
    const monthTrips = allTrips.filter(t => new Date(t.createdAt) >= startOfMonth);

    const calcEarnings = (trips: typeof allTrips) => {
      const totalFare = trips.reduce((sum, t) => sum + t.fare, 0);
      const totalCommission = Math.round(totalFare * commission);
      const netEarnings = totalFare - totalCommission;
      return { tripCount: trips.length, totalFare, totalCommission, netEarnings };
    };

    const today = calcEarnings(todayTrips);
    const week = calcEarnings(weekTrips);
    const month = calcEarnings(monthTrips);
    const allTime = calcEarnings(allTrips);

    // Recent trips (last 10)
    const recentTrips = allTrips.slice(0, 10).map(t => ({
      id: t.id,
      origin: t.originName,
      destination: t.destName,
      fare: t.fare,
      distance: t.distance,
      duration: t.duration,
      payout: Math.round(t.fare * (1 - commission)),
      commission: Math.round(t.fare * commission),
      paymentMethod: t.paymentMethod,
      date: t.createdAt,
    }));

    // Daily earnings for the last 7 days (for chart)
    const dailyEarnings = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(startOfDay);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const dayTrips = allTrips.filter(t => {
        const d = new Date(t.createdAt);
        return d >= dayStart && d < dayEnd;
      });
      const dayFare = dayTrips.reduce((sum, t) => sum + t.fare, 0);
      dailyEarnings.push({
        date: dayStart.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' }),
        trips: dayTrips.length,
        earnings: Math.round(dayFare * (1 - commission)),
      });
    }

    return NextResponse.json({
      driver: {
        isSocio: driver.isSocio,
        commission: commissionLabel,
        walletBalance: driver.walletBalance,
        vehicleType: driver.vehicleType,
        vehiclePlate: driver.vehiclePlate,
      },
      today,
      week,
      month,
      allTime,
      recentTrips,
      dailyEarnings,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Driver earnings error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
