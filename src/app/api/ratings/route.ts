import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

interface CreateRatingBody {
  tripId: string;
  fromUserId: string;
  fromRole: 'passenger' | 'driver';
  toRole: 'passenger' | 'driver';
  stars: number;
  reason?: string;
  comment?: string;
}

// POST /api/ratings — create a rating for a trip
// Privacy: visibleToRecipientAt = createdAt + 7 days.
// Author identity is NEVER revealed — ratings are permanently anonymous.
// The 7-day window only controls WHEN the rating counts toward the
// recipient's average rating, NOT when the author is revealed.
// Anti-retaliation: if more than 7 days have passed since the trip's
// createdAt, the rating is rejected (user lost the right to rate).
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateRatingBody;
    const { tripId, fromUserId, fromRole, toRole, stars, reason, comment } = body;

    // ── Validate ──
    if (!tripId || !fromUserId) {
      return NextResponse.json({ error: 'tripId y fromUserId son requeridos' }, { status: 400 });
    }
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      return NextResponse.json({ error: 'stars debe ser un entero entre 1 y 5' }, { status: 400 });
    }
    // Reason required for 1 or 5 stars (Grupo I2)
    if ((stars === 1 || stars === 5) && (!reason || !reason.trim())) {
      return NextResponse.json(
        { error: 'El motivo es obligatorio para calificaciones de 1 o 5 estrellas' },
        { status: 400 }
      );
    }

    // ── Load trip ──
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        userId: true,
        driverId: true,
        driverName: true,
        createdAt: true,
        status: true,
      },
    });
    if (!trip) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    }

    // ── Determine toUserId based on roles ──
    // passenger → driver: rater is the trip's userId, ratee is the driver (driverId or fallback)
    // driver → passenger: rater is the driver, ratee is the trip's userId
    let toUserId: string | null = null;
    if (fromRole === 'passenger') {
      toUserId = trip.driverId ?? null;
    } else {
      toUserId = trip.userId;
    }
    if (!toUserId) {
      return NextResponse.json(
        { error: 'No se pudo determinar el destinatario de la calificación' },
        { status: 400 }
      );
    }

    // Verify rater identity
    if (fromRole === 'passenger' && trip.userId !== fromUserId) {
      return NextResponse.json({ error: 'El pasajero no coincide con el viaje' }, { status: 403 });
    }

    // ── Anti-retaliation: reject late ratings (> 7 days after trip) ──
    // (Grupo I8)
    const tripAgeMs = Date.now() - trip.createdAt.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if (tripAgeMs > sevenDaysMs) {
      return NextResponse.json(
        { error: 'El período de calificación expiró (máximo 7 días después del viaje)' },
        { status: 400 }
      );
    }

    // ── Idempotency: one rating per (tripId, fromUserId) ──
    const existing = await prisma.rating.findFirst({
      where: { tripId, fromUserId },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Ya calificaste este viaje', id: existing.id },
        { status: 409 }
      );
    }

    // ── Create rating with 7-day delay ──
    const createdAt = new Date();
    const visibleToRecipientAt = new Date(createdAt.getTime() + sevenDaysMs);

    const rating = await prisma.rating.create({
      data: {
        tripId,
        fromUserId,
        toUserId,
        fromRole,
        toRole,
        stars,
        reason: reason?.trim() ?? '',
        comment: comment?.trim() ?? '',
        visibleToRecipientAt,
      },
    });

    return NextResponse.json({
      ok: true,
      rating: {
        id: rating.id,
        stars: rating.stars,
        visibleToRecipientAt: rating.visibleToRecipientAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('POST /api/ratings error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// GET /api/ratings?userId=...&direction=received|sent
// Returns ratings received by (or sent by) the user.
// "Received" ratings are filtered: only those whose `releasedAt` is set
// (7-day delay has passed AND cron has run) include author identity.
// Unreleased ratings show as "Pendiente de liberación" with anonymized author.
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    const direction = (request.nextUrl.searchParams.get('direction') ?? 'received') as 'received' | 'sent';

    if (!userId) {
      return NextResponse.json({ error: 'userId requerido' }, { status: 400 });
    }

    const where = direction === 'received' ? { toUserId: userId } : { fromUserId: userId };

    const ratings = await prisma.rating.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        trip: {
          select: {
            id: true,
            originName: true,
            destName: true,
            createdAt: true,
          },
        },
      },
    });

    // For "received" ratings, author identity is ALWAYS hidden.
    // Ratings are permanently anonymous — the fromUserId is NEVER revealed
    // to the recipient, even after the 7-day window.
    // For "sent" ratings, the rater is the user themselves, no privacy concern.
    const sanitized = ratings.map((r) => {
      const isSent = direction === 'sent';
      return {
        id: r.id,
        tripId: r.tripId,
        fromUserId: isSent ? r.fromUserId : null, // NEVER reveal author to recipient
        toUserId: r.toUserId,
        fromRole: r.fromRole,
        toRole: r.toRole,
        stars: r.stars,
        reason: r.reason,
        comment: r.comment,
        createdAt: r.createdAt.toISOString(),
        visibleToRecipientAt: r.visibleToRecipientAt.toISOString(),
        releasedAt: r.releasedAt?.toISOString() ?? null,
        seenAt: r.seenAt?.toISOString() ?? null,
        authorName: null, // ALWAYS null — permanent anonymity
        trip: r.trip
          ? {
              id: r.trip.id,
              originName: r.trip.originName,
              destName: r.trip.destName,
              createdAt: r.trip.createdAt.toISOString(),
            }
          : null,
      };
    });

    return NextResponse.json({ ratings: sanitized });
  } catch (error) {
    console.error('GET /api/ratings error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PATCH /api/ratings — mark a rating as seen (when recipient opens it)
interface PatchBody {
  ratingId: string;
  markSeen?: boolean;
}
export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as PatchBody;
    const { ratingId, markSeen } = body;
    if (!ratingId) {
      return NextResponse.json({ error: 'ratingId requerido' }, { status: 400 });
    }
    if (markSeen) {
      const updated = await prisma.rating.update({
        where: { id: ratingId },
        data: { seenAt: new Date() },
      });
      return NextResponse.json({ ok: true, seenAt: updated.seenAt?.toISOString() ?? null });
    }
    return NextResponse.json({ ok: true, changed: false });
  } catch (error) {
    console.error('PATCH /api/ratings error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
