import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * GET /api/admin/ops/passengers?adminUserId=...&query=...&page=1&limit=20&sort=rewardPoints&dir=desc
 * Returns a paginated list of passengers with trip counts, spending, rating, and reward info.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const adminUserId = searchParams.get('adminUserId');
    const query = searchParams.get('query') || '';
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10), 100);
    const sortField = searchParams.get('sort') || 'tripCountAsPassenger';
    const sortDir = searchParams.get('dir') || 'desc';
    const levelFilter = searchParams.get('level') || ''; // bronze|silver|gold|platinum

    if (!adminUserId) {
      return NextResponse.json({ error: 'Missing adminUserId' }, { status: 400 });
    }

    // Verify admin
    const admin = await prisma.user.findUnique({ where: { id: adminUserId } });
    if (!admin?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build where clause
    const where: Record<string, unknown> = {
      role: { in: ['passenger', 'driver'] }, // show all users, even drivers who are also passengers
    };

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      (where as Record<string, unknown>).OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
        { email: { contains: q } },
        { dni: { contains: q } },
      ];
    }

    if (levelFilter) {
      (where as Record<string, unknown>).rewardLevel = levelFilter;
    }

    // Count
    const total = await prisma.user.count({ where });

    // Fetch
    const orderBy: Record<string, string> = {};
    orderBy[sortField] = sortDir;

    const passengers = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        dni: true,
        avatar: true,
        role: true,
        isDriver: true,
        tripCountAsPassenger: true,
        tripCountAsDriver: true,
        totalSpent: true,
        totalEarned: true,
        averageRating: true,
        ratingCount: true,
        walletBalance: true,
        rewardPoints: true,
        rewardLevel: true,
        rewardLevelUpdatedAt: true,
        isSocio: true,
        createdAt: true,
        lastLat: true,
        lastLng: true,
        lastLocationUpdatedAt: true,
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    });

    // Get tier thresholds
    const tiers = await prisma.rewardTier.findMany({
      orderBy: { minPoints: 'asc' },
    });

    return NextResponse.json({
      passengers,
      tiers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[ops/passengers] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
