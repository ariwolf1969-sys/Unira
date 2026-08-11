import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

interface CreateShareBody {
  tripId: string;
  userId: string;
}

// POST /api/share — create a share link for a trip
// Returns a token that can be used to view the trip on /viaje/[token]
// without authentication. The link auto-expires 24h after creation.
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateShareBody;
    const { tripId, userId } = body;

    if (!tripId || !userId) {
      return NextResponse.json(
        { error: 'tripId y userId son requeridos' },
        { status: 400 }
      );
    }

    // Verify the trip exists and belongs to the user
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true, userId: true, status: true },
    });

    if (!trip) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    }

    if (trip.userId !== userId) {
      return NextResponse.json(
        { error: 'No tenés permiso para compartir este viaje' },
        { status: 403 }
      );
    }

    // Check if there's already an active share link for this trip
    const existing = await prisma.sharedTrip.findFirst({
      where: {
        tripId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      return NextResponse.json({ token: existing.token, expiresAt: existing.expiresAt.toISOString() });
    }

    // Generate a random token (URL-safe, 16 chars)
    const token = generateToken();

    // Expires in 24h
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const shared = await prisma.sharedTrip.create({
      data: {
        tripId,
        userId,
        token,
        expiresAt,
      },
    });

    return NextResponse.json({
      token: shared.token,
      expiresAt: shared.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('POST /api/share error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Generate a URL-safe random token of 16 chars
function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 16; i++) {
    token += chars[bytes[i] % chars.length];
  }
  return token;
}
