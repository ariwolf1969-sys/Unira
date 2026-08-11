import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * GET /api/admin/ops/passenger/[id]?adminUserId=...
 * Returns passenger detail with trip history and reward log.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = req.nextUrl;
    const adminUserId = searchParams.get('adminUserId');

    if (!adminUserId) {
      return NextResponse.json({ error: 'Missing adminUserId' }, { status: 400 });
    }

    const admin = await prisma.user.findUnique({ where: { id: adminUserId } });
    if (!admin?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        dni: true,
        avatar: true,
        role: true,
        isDriver: true,
        isSocio: true,
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
        createdAt: true,
        address: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Get trip history (as passenger) — last 50
    const tripsAsPassenger = await prisma.trip.findMany({
      where: { userId: id, status: { in: ['completed', 'cancelled'] } },
      select: {
        id: true,
        status: true,
        originName: true,
        destName: true,
        fare: true,
        distance: true,
        duration: true,
        paymentMethod: true,
        driverId: true,
        driverName: true,
        rating: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Get reward log — last 30 entries
    const rewardLogs = await prisma.rewardLog.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    // Get available discounts for this user
    const now = new Date();
    const discounts = await prisma.discount.findMany({
      where: {
        OR: [
          { userId: null }, // available to all
          { userId: id },   // assigned specifically
        ],
        validFrom: { lte: now },
        validUntil: { gt: now },
        usesCount: { lt: 1000 }, // has remaining uses
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Get tier thresholds
    const tiers = await prisma.rewardTier.findMany({
      orderBy: { minPoints: 'asc' },
    });

    return NextResponse.json({
      user,
      tripsAsPassenger,
      rewardLogs,
      discounts,
      tiers,
    });
  } catch (error) {
    console.error('[ops/passenger/[id]] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/ops/passenger/[id]?adminUserId=...
 * Admin actions: award/remove points, set level, assign discount
 * Body: { action: 'award_points'|'remove_points'|'set_level', points?: number, level?: string, reason?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = req.nextUrl;
    const adminUserId = searchParams.get('adminUserId');
    const body = await req.json();
    const { action, points, level, reason } = body as {
      action: 'award_points' | 'remove_points' | 'set_level';
      points?: number;
      level?: string;
      reason?: string;
    };

    if (!adminUserId) {
      return NextResponse.json({ error: 'Missing adminUserId' }, { status: 400 });
    }

    const admin = await prisma.user.findUnique({ where: { id: adminUserId } });
    if (!admin?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (action === 'award_points' && typeof points === 'number') {
      // Award points
      const updatedUser = await prisma.user.update({
        where: { id },
        data: { rewardPoints: { increment: points } },
      });
      await prisma.rewardLog.create({
        data: {
          userId: id,
          points,
          reason: reason || `Premio administrativo (+${points} pts)`,
          referenceId: `admin_${adminUserId}`,
        },
      });
      // Auto-promote tier
      await autoPromoteTier(id, updatedUser.rewardPoints);
      return NextResponse.json({ ok: true, rewardPoints: updatedUser.rewardPoints });
    }

    if (action === 'remove_points' && typeof points === 'number') {
      const newPoints = Math.max(0, user.rewardPoints - points);
      await prisma.user.update({
        where: { id },
        data: { rewardPoints: newPoints },
      });
      await prisma.rewardLog.create({
        data: {
          userId: id,
          points: -points,
          reason: reason || `Descuento administrativo (-${points} pts)`,
          referenceId: `admin_${adminUserId}`,
        },
      });
      await autoPromoteTier(id, newPoints);
      return NextResponse.json({ ok: true, rewardPoints: newPoints });
    }

    if (action === 'set_level' && level) {
      await prisma.user.update({
        where: { id },
        data: {
          rewardLevel: level,
          rewardLevelUpdatedAt: new Date(),
        },
      });
      await prisma.rewardLog.create({
        data: {
          userId: id,
          points: 0,
          reason: `Nivel cambiado a ${level} por administrador`,
          referenceId: `admin_${adminUserId}`,
        },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (error) {
    console.error('[POST ops/passenger/[id]] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Auto-promote tier based on points */
async function autoPromoteTier(userId: string, totalPoints: number) {
  const tiers = await prisma.rewardTier.findMany({
    orderBy: { minPoints: 'desc' },
  });
  for (const tier of tiers) {
    if (totalPoints >= tier.minPoints) {
      await prisma.user.update({
        where: { id: userId },
        data: { rewardLevel: tier.level, rewardLevelUpdatedAt: new Date() },
      });
      break;
    }
  }
}
