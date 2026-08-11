import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// Vercel Cron Job: recomputes averageRating + ratingCount for users
// whose ratings have passed the 7-day visibility window.
//
// IMPORTANT: Ratings are ALWAYS anonymous. The author identity is NEVER
// revealed to the recipient, even after 7 days. This cron only marks
// ratings as "counted" (releasedAt) so they factor into the average
// rating displayed on profiles. The fromUserId is NEVER exposed.
//
// Configure in vercel.json:
//   { "crons": [{ "path": "/api/cron/release-ratings", "schedule": "0 3 * * *" }] }
// Runs daily at 03:00 UTC (midnight BUE/ART). Idempotent: safe to run multiple times.
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET;
    if (expectedSecret) {
      const provided = authHeader?.replace('Bearer ', '');
      if (provided !== expectedSecret) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }
    }

    const now = new Date();

    // Find all ratings whose 7-day window has passed but haven't been "counted" yet.
    // "releasedAt" here means "counted toward average", NOT "author revealed".
    // Author identity is NEVER revealed — ratings are permanently anonymous.
    const pending = await prisma.rating.findMany({
      where: {
        releasedAt: null,
        visibleToRecipientAt: { lt: now },
      },
      select: { id: true },
    });

    if (pending.length === 0) {
      return NextResponse.json({ ok: true, released: 0, message: 'No hay calificaciones pendientes de computo.' });
    }

    // Bulk mark as "counted"
    const result = await prisma.rating.updateMany({
      where: { id: { in: pending.map((p) => p.id) } },
      data: { releasedAt: now },
    });

    // ── Recompute averageRating + ratingCount for affected users ──
    const releasedRatings = await prisma.rating.findMany({
      where: { id: { in: pending.map((p) => p.id) } },
      select: { toUserId: true },
      distinct: ['toUserId'],
    });

    for (const r of releasedRatings) {
      const agg = await prisma.rating.aggregate({
        where: { toUserId: r.toUserId, releasedAt: { not: null } },
        _avg: { stars: true },
        _count: { stars: true },
      });
      await prisma.user.update({
        where: { id: r.toUserId },
        data: {
          averageRating: agg._avg.stars ?? 0,
          ratingCount: agg._count.stars ?? 0,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      counted: result.count,
      recomputedUsers: releasedRatings.length,
      runAt: now.toISOString(),
    });
  } catch (error) {
    console.error('GET /api/cron/release-ratings error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
