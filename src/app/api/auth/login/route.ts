import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

const TOKEN_SECRET = 'unira-coop-secret-2025';

function generateToken(userId: string): string {
  return crypto.createHash('sha256').update(userId + TOKEN_SECRET).digest('hex').substring(0, 32);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json(
        { error: 'Teléfono es requerido' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    const token = generateToken(user.id);

    return NextResponse.json({
      user: {
        uid: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email || '',
        dni: user.dni || '',
        avatar: user.avatar || '',
        role: user.role,
        isDriverApproved: user.isDriverApproved,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
