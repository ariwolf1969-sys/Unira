import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/sos/[id]/resolve
 * Marks an SOS alert as resolved or false_alarm.
 *
 * Body: { status: 'resolved' | 'false_alarm', note?: string, resolvedBy?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, note, resolvedBy } = body as {
      status: 'resolved' | 'false_alarm';
      note?: string;
      resolvedBy?: string;
    };

    if (!['resolved', 'false_alarm'].includes(status)) {
      return NextResponse.json({ error: 'status inválido' }, { status: 400 });
    }

    const updated = await prisma.sosAlert.update({
      where: { id },
      data: {
        status,
        resolutionNote: note || '',
        resolvedAt: new Date(),
        resolvedBy: resolvedBy || null,
      },
    });

    return NextResponse.json({ ok: true, alert: updated });
  } catch (err) {
    console.error('[POST /api/sos/[id]/resolve] error:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
