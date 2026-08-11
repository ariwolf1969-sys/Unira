import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateEmailToken, emailTokenExpiry } from '@/lib/verification';
import { sendVerificationEmail } from '@/lib/email';

export const runtime = 'nodejs';

function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('549')) digits = digits.slice(3);
  else if (digits.startsWith('54')) digits = digits.slice(2);
  if (digits.length === 10 && !digits.startsWith('15')) digits = '15' + digits;
  return '+54' + digits;
}

interface ResendEmailBody {
  phone?: string;  // identify user by phone
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ResendEmailBody;
    const { phone } = body;

    if (!phone) {
      return NextResponse.json(
        { error: 'Teléfono es requerido' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhone(phone);

    const user = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
      select: { id: true, email: true, name: true, emailVerifiedAt: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    if (!user.email) {
      return NextResponse.json(
        { error: 'No hay email registrado' },
        { status: 400 }
      );
    }

    if (user.emailVerifiedAt) {
      return NextResponse.json({
        success: true,
        alreadyVerified: true,
        message: 'El email ya está verificado',
      });
    }

    // Generate new token
    const token = generateEmailToken();
    const expiresAt = emailTokenExpiry();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyToken: token,
        emailVerifyExpiresAt: expiresAt,
      },
    });

    const emailResult = await sendVerificationEmail(user.email, user.name, token);

    if (!emailResult.success) {
      // Surface the specific provider error so the UI can show it
      return NextResponse.json(
        {
          success: false,
          error: emailResult.error || 'No se pudo enviar el email.',
        },
        { status: 200 }  // 200 with success: false so the UI reads the message
      );
    }

    return NextResponse.json({
      success: true,
      dev: {
        emailVerifyUrl: emailResult.devMode ? emailResult.devLink : undefined,
      },
    });
  } catch (error) {
    console.error('Resend email error:', error);
    const msg = error instanceof Error ? error.message : 'unknown';
    if (msg.includes('does not exist') || msg.toLowerCase().includes('column')) {
      return NextResponse.json(
        {
          success: false,
          error: 'La base de datos del servidor no está sincronizada. El administrador debe ejecutar `prisma db push`.',
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
