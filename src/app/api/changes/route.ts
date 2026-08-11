import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

// Fields that require admin approval to change
const APPROVAL_FIELDS = new Set([
  'phone', 'email',
  'vehicleType', 'vehiclePlate', 'vehicleBrand', 'vehicleModel', 'vehicleYear', 'vehicleColor',
  'cbuNumber', 'cbuAlias', 'cbuHolderName',
]);

// ── GET /api/changes?userId=... ──
// Returns pending changes for a user (and optionally all pending for admin)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status') || 'pending';
    const allPending = searchParams.get('all') === 'true'; // admin: all users

    if (!userId && !allPending) {
      return NextResponse.json({ error: 'userId requerido' }, { status: 400 });
    }

    const where: Record<string, unknown> = { status };
    if (userId) {
      where.userId = userId;
    }

    const changes = await prisma.pendingChange.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // If all=true, enrich with user name/phone
    let enriched = changes;
    if (allPending) {
      const userIds = [...new Set(changes.map(c => c.userId))];
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, phone: true },
      });
      const userMap = new Map(users.map(u => [u.id, { name: u.name, phone: u.phone }]));
      enriched = changes.map(c => ({
        ...c,
        user: userMap.get(c.userId) || null,
      }));
    }

    return NextResponse.json({ changes: enriched });
  } catch (error: any) {
    console.error('GET /api/changes error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST /api/changes ──
// User requests a data change (requires approval)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, field, newValue, reason } = body;

    if (!userId || !field || newValue === undefined || newValue === null) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    if (!APPROVAL_FIELDS.has(field)) {
      return NextResponse.json({ error: `El campo "${field}" no requiere aprobación` }, { status: 400 });
    }

    // Get current value
    let oldValue = '';
    if (['cbuNumber', 'cbuAlias', 'cbuHolderName'].includes(field)) {
      const cfg = await prisma.driverConfig.findUnique({ where: { userId } });
      if (cfg) {
        oldValue = (cfg as Record<string, unknown>)[field] as string || '';
      }
    } else {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        oldValue = (user as Record<string, unknown>)[field] as string || '';
      }
    }

    // Check if there's already a pending request for this field
    const existing = await prisma.pendingChange.findFirst({
      where: { userId, field, status: 'pending' },
    });
    if (existing) {
      // Update the existing pending request
      await prisma.pendingChange.update({
        where: { id: existing.id },
        data: { newValue: String(newValue), reason: reason || '', oldValue },
      });
      return NextResponse.json({ ok: true, id: existing.id, message: 'Solicitud actualizada' });
    }

    const change = await prisma.pendingChange.create({
      data: {
        userId,
        field,
        oldValue: String(oldValue),
        newValue: String(newValue),
        reason: reason || '',
      },
    });

    return NextResponse.json({ ok: true, id: change.id, message: 'Solicitud enviada. La empresa la revisará y aprobará.' });
  } catch (error: any) {
    console.error('POST /api/changes error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── PATCH /api/changes ──
// Admin approves or rejects a change
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { changeId, status, reviewedBy } = body;

    if (!changeId || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'changeId y status (approved/rejected) requeridos' }, { status: 400 });
    }

    const change = await prisma.pendingChange.findUnique({ where: { id: changeId } });
    if (!change) {
      return NextResponse.json({ error: 'Cambio no encontrado' }, { status: 404 });
    }

    if (change.status !== 'pending') {
      return NextResponse.json({ error: 'Este cambio ya fue procesado' }, { status: 400 });
    }

    // If approved, apply the change
    if (status === 'approved') {
      const field = change.field;
      const newValue = change.newValue;

      if (['cbuNumber', 'cbuAlias', 'cbuHolderName'].includes(field)) {
        await prisma.driverConfig.upsert({
          where: { userId: change.userId },
          create: { userId, [field]: newValue },
          update: { [field]: newValue },
        });
      } else if (field === 'vehicleYear') {
        await prisma.user.update({
          where: { id: change.userId },
          data: { [field]: parseInt(newValue, 10) || null },
        });
      } else {
        await prisma.user.update({
          where: { id: change.userId },
          data: { [field]: newValue },
        });
      }
    }

    // Update the change record
    await prisma.pendingChange.update({
      where: { id: changeId },
      data: {
        status,
        reviewedBy: reviewedBy || 'admin',
        reviewedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, status });
  } catch (error: any) {
    console.error('PATCH /api/changes error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
