import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST: Cancel a trip (passenger or driver)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { cancelledBy } = body; // 'passenger' | 'driver'

    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    }

    if (trip.status === 'completed') {
      return NextResponse.json({ error: 'Viaje ya finalizado' }, { status: 400 });
    }

    await prisma.trip.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    // Clear driver's active trip if applicable
    if (trip.driverId) {
      await prisma.user.update({
        where: { id: trip.driverId },
        data: { currentTripId: '' },
      });
    }

    return NextResponse.json({ success: true, cancelledBy });
  } catch (error: any) {
    console.error('Cancel trip error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
