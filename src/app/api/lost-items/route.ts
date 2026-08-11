import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/lost-items
 *   ?userId=...         — list items reported by this user
 *   ?found=true         — list public "found" items (driver reports)
 *   ?status=open        — filter by status (open | matched | closed)
 *
 * POST /api/lost-items
 *   Create a new lost/found item report.
 *   Body: { reporterType, reporterId, reporterName, reporterPhone, tripId?, itemType, description, photo?, foundLocation? }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const foundOnly = searchParams.get('found') === 'true';
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (userId) where.reporterId = userId;
    if (foundOnly) where.reporterType = 'driver';
    if (status) where.status = status;

    const items = await prisma.lostItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Get lost-items error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      reporterType,
      reporterId,
      reporterName,
      reporterPhone,
      tripId,
      itemType,
      description,
      photo,
      foundLocation,
    } = body;

    if (!reporterType || !reporterId || !reporterName || !reporterPhone || !itemType || !description) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios' },
        { status: 400 }
      );
    }

    const item = await prisma.lostItem.create({
      data: {
        reporterType,
        reporterId,
        reporterName,
        reporterPhone,
        tripId: tripId || null,
        itemType: itemType.slice(0, 100),
        description: description.slice(0, 1000),
        photo: photo || '',
        foundLocation: foundLocation || '',
        status: 'open',
      },
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error('Create lost-item error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/**
 * PATCH /api/lost-items
 *   Update status (e.g. mark as matched/closed) — admin only in production.
 *   Body: { id, status, resolvedAt? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'id y status son requeridos' }, { status: 400 });
    }

    const updated = await prisma.lostItem.update({
      where: { id },
      data: {
        status,
        resolvedAt: status === 'closed' ? new Date() : null,
      },
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error('Update lost-item error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
