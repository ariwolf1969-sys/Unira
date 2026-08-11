import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateOtp, otpExpiry, deliverOtp } from '@/lib/verification';

export const runtime = 'nodejs';

function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('549')) digits = digits.slice(3);
  else if (digits.startsWith('54')) digits = digits.slice(2);
  if (digits.length === 10 && !digits.startsWith('15')) digits = '15' + digits;
  return '+54' + digits;
}

interface ResendOtpBody {
  phone?: string;
  /** Optional: force a specific channel for this resend. */
  channel?: 'telegram' | 'sms' | 'whatsapp';
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ResendOtpBody;
    const { phone, channel } = body;

    if (!phone) {
      return NextResponse.json(
        { error: 'Teléfono es requerido' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhone(phone);

    const user = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
      select: {
        id: true,
        phoneVerifiedAt: true,
        telegramChatId: true,
        otpChannel: true,
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
        message: 'El teléfono ya está verificado',
      });
    }

    // Generate new OTP
    const phoneOtp = generateOtp();
    const phoneOtpExpiresAt = otpExpiry();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        phoneOtp,
        phoneOtpExpiresAt,
      },
    });

    // Deliver via the preferred channel (or override with the one requested)
    const preferred = (channel ?? user.otpChannel ?? 'telegram') as
      | 'telegram'
      | 'sms'
      | 'whatsapp';
    const result = await deliverOtp(
      {
        phone: normalizedPhone,
        telegramChatId: user.telegramChatId,
        preferredChannel: preferred,
      },
      phoneOtp
    );

    return NextResponse.json({
      success: result.success,
      otp: {
        channel: result.channel,
        needsTelegramLink: result.needsTelegramLink,
        telegramBotLink: result.telegramBotLink,
        error: result.error,
      },
      dev: {
        phoneOtp: result.devMode ? phoneOtp : undefined,
      },
      // If delivery hard-failed (e.g. invalid phone, all providers down),
      // return 200 with success: false so the UI can show the specific error
      // instead of a generic "internal server error".
      error: result.success ? undefined : result.error,
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    // Distinguish schema/DB errors from real server errors so the operator
    // knows when to push the schema.
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
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
