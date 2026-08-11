import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

interface RejectBody {
  adminUserId?: string;
  targetUserId?: string;
  reason?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RejectBody;
    const { adminUserId, targetUserId, reason } = body;

    // Auth check
    if (!adminUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const admin = await prisma.user.findUnique({
      where: { id: adminUserId },
      select: { isAdmin: true },
    });
    if (!admin || !admin.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - se requiere admin' },
        { status: 403 }
      );
    }

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'targetUserId es requerido' },
        { status: 400 }
      );
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true },
    });

    if (!target) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Reject: set status to rejected, also unapprove driver if was approved
    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        verificationStatus: 'rejected',
        isDriverApproved: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${target.name} rechazado${reason ? `: ${reason}` : ''}`,
    });
  } catch (error) {
    console.error('Admin reject error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
