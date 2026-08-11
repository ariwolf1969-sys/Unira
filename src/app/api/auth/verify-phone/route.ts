import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isOtpValid } from '@/lib/verification';

export const runtime = 'nodejs';

function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('549')) digits = digits.slice(3);
  else if (digits.startsWith('54')) digits = digits.slice(2);
  if (digits.length === 10 && !digits.startsWith('15')) digits = '15' + digits;
  return '+54' + digits;
}

interface VerifyPhoneBody {
  phone?: string;
  code?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as VerifyPhoneBody;
    const { phone, code } = body;

    if (!phone || !code) {
      return NextResponse.json(
        { error: 'Teléfono y código son requeridos' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhone(phone);

    const user = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
      select: {
        id: true,
        phoneOtp: true,
        phoneOtpExpiresAt: true,
        phoneVerifiedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    if (user.phoneVerifiedAt) {
      return NextResponse.json({
        success: true,
        alreadyVerified: true,
        message: 'El teléfono ya estaba verificado',
      });
    }

    if (!user.phoneOtp || !user.phoneOtpExpiresAt) {
      return NextResponse.json(
        { error: 'No hay código pendiente. Solicitá uno nuevo.' },
        { status: 400 }
      );
    }

    if (!isOtpValid(user.phoneOtpExpiresAt)) {
      return NextResponse.json(
        { error: 'El código expiró. Solicitá uno nuevo.' },
        { status: 400 }
      );
    }

    if (user.phoneOtp !== code) {
      return NextResponse.json(
        { error: 'Código incorrecto' },
        { status: 400 }
      );
    }

    // Success: mark phone as verified, clear OTP
    await prisma.user.update({
      where: { id: user.id },
      data: {
        phoneVerifiedAt: new Date(),
        phoneOtp: null,
        phoneOtpExpiresAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Teléfono verificado correctamente',
    });
  } catch (error) {
    console.error('Verify phone error:', error);
    const msg = error instanceof Error ? error.message : 'unknown';
    // Distinguish schema/DB errors from real server errors
    if (msg.includes('does not exist') || msg.toLowerCase().includes('column')) {
      return NextResponse.json(
        {
          error: 'La base de datos del servidor no está sincronizada. El administrador debe ejecutar `prisma db push`.',
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: 'Error interno del servidor. Reintentá en unos minutos.' },
      { status: 500 }
    );
  }
}
