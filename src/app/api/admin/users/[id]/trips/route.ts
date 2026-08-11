import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * GET /api/admin/users/[id]/trips?adminUserId=xxx&role=driver|passenger&limit=20&offset=0
 * Returns paginated trip list for a specific user (as driver or as passenger).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const adminUserId = searchParams.get('adminUserId');
    const role = searchParams.get('role') || 'driver'; // 'driver' | 'passenger'
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Auth check — require admin
    if (!adminUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const admin = await prisma.user.findUnique({
      where: { id: adminUserId },
      select: { isAdmin: true },
    });
    if (!admin || !admin.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - se requiere admin' },
        { status: 403 }
      );
    }

    const whereClause =
      role === 'driver'
        ? { driverId: id }
        : { userId: id, driverId: { not: '' } }; // exclude trips where user is both passenger and there's no driver

    const [trips, total] = await Promise.all([
      prisma.trip.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          type: true,
          status: true,
          originName: true,
          destName: true,
          fare: true,
          vehicleType: true,
          distance: true,
          duration: true,
          paymentMethod: true,
          createdAt: true,
          // If role is driver, fetch passenger info
          ...(role === 'driver'
            ? {
                userId: true,
                user: {
                  select: { id: true, name: true, phone: true },
                },
              }
            : {
                driverId: true,
                driverName: true,
                driverPhoto: true,
                driverVehicle: true,
              }),
        },
      }),
      prisma.trip.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      trips,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Admin user trips error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
