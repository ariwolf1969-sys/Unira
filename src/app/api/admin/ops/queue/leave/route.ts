import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adminUserId, entryId } = body;

    if (!adminUserId || !entryId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify admin
    const admin = await prisma.user.findUnique({ where: { id: adminUserId } });
    if (!admin?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Find the entry
    const entry = await prisma.queueEntry.findUnique({
      where: { id: entryId },
    });
    if (!entry || entry.status !== 'waiting') {
      return NextResponse.json({ error: 'Entry not found or not waiting' }, { status: 404 });
    }

    // Mark as left
    const updated = await prisma.queueEntry.update({
      where: { id: entryId },
      data: { status: 'left' },
    });

    // Reposition remaining entries in the same queue
    const remainingEntries = await prisma.queueEntry.findMany({
      where: { locationId: entry.locationId, status: 'waiting' },
      orderBy: { joinedAt: 'asc' },
    });

    // Update positions
    for (let i = 0; i < remainingEntries.length; i++) {
      const newPos = i + 1;
      const estWait = newPos * 3;
      await prisma.queueEntry.update({
        where: { id: remainingEntries[i].id },
        data: { position: newPos, estimatedWaitMinutes: estWait },
      });
    }

    return NextResponse.json({ success: true, entry: updated });
  } catch (error) {
    console.error('[ops/queue/leave] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
