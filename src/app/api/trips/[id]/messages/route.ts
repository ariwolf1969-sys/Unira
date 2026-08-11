import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET: List messages for a trip
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const since = searchParams.get('since');

    if (!userId) {
      return NextResponse.json({ error: 'userId requerido' }, { status: 400 });
    }

    // Verify the user is part of this trip
    const trip = await prisma.trip.findUnique({
      where: { id },
      select: { userId: true, driverId: true },
    });
    if (!trip) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    }
    if (trip.userId !== userId && trip.driverId !== userId) {
      return NextResponse.json({ error: 'No sos parte de este viaje' }, { status: 403 });
    }

    // Mark messages as read for this user
    await prisma.tripMessage.updateMany({
      where: {
        tripId: id,
        toUserId: userId,
        read: false,
      },
      data: { read: true },
    });

    // Fetch messages
    const whereClause: Record<string, unknown> = { tripId: id };
    if (since) {
      whereClause.createdAt = { gt: new Date(since) };
    }

    const messages = await prisma.tripMessage.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    return NextResponse.json({ messages });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Get messages error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST: Send a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { fromUserId, text } = body;

    if (!fromUserId || !text) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    // Verify the user is part of this trip
    const trip = await prisma.trip.findUnique({
      where: { id },
      select: { userId: true, driverId: true },
    });
    if (!trip) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    }
    if (trip.userId !== fromUserId && trip.driverId !== fromUserId) {
      return NextResponse.json({ error: 'No sos parte de este viaje' }, { status: 403 });
    }

    // Determine recipient
    const toUserId = trip.userId === fromUserId
      ? (trip.driverId || '')
      : trip.userId;

    if (!toUserId) {
      return NextResponse.json({ error: 'No hay destinatario' }, { status: 400 });
    }

    const message = await prisma.tripMessage.create({
      data: {
        tripId: id,
        fromUserId,
        toUserId,
        text: text.slice(0, 500), // Limit to 500 chars
      },
    });

    return NextResponse.json({ message });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Send message error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
