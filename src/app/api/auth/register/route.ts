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
    const { name, phone } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { error: 'Nombre y teléfono son requeridos' },
        { status: 400 }
      );
    }

    // Find existing user or create new one
    const user = await prisma.user.upsert({
      where: { phone },
      create: {
        name,
        phone,
        email: '',
        role: 'passenger',
        walletBalance: 15000,
      },
      update: {
        name,
      },
    });

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
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
