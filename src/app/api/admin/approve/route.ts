import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

interface ApproveBody {
  adminUserId?: string;     // the admin performing the action
  targetUserId?: string;    // the user to approve
  approveDriver?: boolean;  // if true, also approve driver status
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ApproveBody;
    const { adminUserId, targetUserId, approveDriver = false } = body;

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
      select: { id: true, name: true, isDriver: true },
    });

    if (!target) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Approve: set verificationStatus to verified, optionally approve driver
    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        verificationStatus: 'verified',
        ...(approveDriver && target.isDriver ? { isDriverApproved: true } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      message: approveDriver
        ? `${target.name} aprobado como conductor`
        : `${target.name} verificado`,
    });
  } catch (error) {
    console.error('Admin approve error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
