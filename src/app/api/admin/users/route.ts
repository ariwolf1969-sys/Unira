import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

async function requireAdmin(userId: string | undefined) {
  if (!userId) return { error: 'Unauthorized', status: 401 };
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  });
  if (!user || !user.isAdmin) {
    return { error: 'Forbidden - se requiere admin', status: 403 };
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || undefined;
    const status = (searchParams.get('status') as 'pending' | 'verified' | 'rejected' | 'all') || 'pending';
    const role = (searchParams.get('role') as 'driver' | 'passenger' | 'all') || 'all';
    const query = (searchParams.get('q') || '').trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '50', 10)));

    const authError = await requireAdmin(userId);
    if (authError) {
      return NextResponse.json({ error: authError.error }, { status: authError.status });
    }

    const where: Record<string, unknown> = {};

    // When there's a search query, search across ALL statuses unless status=all
    // (This fixes the bug where searching on "Pendientes" tab wouldn't find approved users)
    if (query) {
      // Don't filter by status when searching — search globally
    } else {
      if (status !== 'all') where.verificationStatus = status;
    }

    if (role === 'driver') where.isDriver = true;
    if (role === 'passenger') where.isDriver = false;

    // Search by name, phone, email, or DNI (case-insensitive via LIKE)
    if (query) {
      const likePattern = `%${query}%`;
      where.OR = [
        { name: { contains: query } },
        { phone: { contains: query } },
        { email: { contains: query } },
        { dni: { contains: query } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          dni: true,
          birthday: true,
          address: true,
          role: true,
          isDriver: true,
          isDriverApproved: true,
          isAdmin: true,
          verificationStatus: true,
          phoneVerifiedAt: true,
          emailVerifiedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    // Stats (always computed globally, not affected by search)
    const [pending, verified, rejected, drivers, totalAll] = await Promise.all([
      prisma.user.count({ where: { verificationStatus: 'pending' } }),
      prisma.user.count({ where: { verificationStatus: 'verified' } }),
      prisma.user.count({ where: { verificationStatus: 'rejected' } }),
      prisma.user.count({ where: { isDriver: true } }),
      prisma.user.count(),
    ]);

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      stats: { pending, verified, rejected, drivers, total: totalAll },
    });
  } catch (error) {
    console.error('Admin users error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// BATCH approve/reject — POST /api/admin/users with body: { adminUserId, action, userIds }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminUserId, action, userIds } = body as {
      adminUserId?: string;
      action?: 'approve' | 'reject';
      userIds?: string[];
    };

    const authError = await requireAdmin(adminUserId);
    if (authError) {
      return NextResponse.json({ error: authError.error }, { status: authError.status });
    }

    if (!action || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'action y userIds son requeridos' }, { status: 400 });
    }

    if (userIds.length > 100) {
      return NextResponse.json({ error: 'Máximo 100 usuarios por operación' }, { status: 400 });
    }

    if (action === 'approve') {
      const result = await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { verificationStatus: 'verified' },
      });
      return NextResponse.json({ success: true, approved: result.count });
    }

    if (action === 'reject') {
      const result = await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { verificationStatus: 'rejected', isDriverApproved: false },
      });
      return NextResponse.json({ success: true, rejected: result.count });
    }

    return NextResponse.json({ error: 'Acción no válida. Usá "approve" o "reject".' }, { status: 400 });
  } catch (error) {
    console.error('Admin batch error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
