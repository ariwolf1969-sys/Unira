import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST: Driver verifies passenger's 4-digit code
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json({ error: 'Código requerido' }, { status: 400 });
    }

    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    }

    if (trip.status === 'in_progress') {
      return NextResponse.json({ success: true, message: 'Viaje ya está en curso' });
    }

    if (trip.status !== 'accepted') {
      return NextResponse.json({ error: 'Viaje no fue aceptado' }, { status: 400 });
    }

    if (trip.verificationCode !== code) {
      return NextResponse.json({ success: false, error: 'Código incorrecto' }, { status: 403 });
    }

    // Code matches — start the trip
    await prisma.trip.update({
      where: { id },
      data: { status: 'in_progress' },
    });

    return NextResponse.json({ success: true, message: 'Código verificado, viaje iniciado' });
  } catch (error: any) {
    console.error('Verify code error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
