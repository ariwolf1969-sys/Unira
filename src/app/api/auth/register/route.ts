import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { generateOtp, generateEmailToken, otpExpiry, emailTokenExpiry, deliverOtp } from '@/lib/verification';
import { sendVerificationEmail } from '@/lib/email';
import { normalizePhone } from '@/lib/phone';

const TOKEN_SECRET = 'unira-coop-secret-2025';

function generateToken(userId: string): string {
  return crypto.createHash('sha256').update(userId + TOKEN_SECRET).digest('hex').substring(0, 32);
}

export const runtime = 'nodejs';

interface RegisterBody {
  name?: string;
  phone?: string;
  email?: string;
  dni?: string;
  birthday?: string;
  dniFront?: string;
  dniBack?: string;
  facePhoto?: string;
  selfieWithDni?: string;
  licenseFront?: string;
  licenseBack?: string;
  // Driver vehicle info (Session 17)
  vehicleType?: string;
  vehiclePlate?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  vehicleColor?: string;
  cedulaVerdeAzul?: string;
  cedulaVerdeAzulBack?: string;
  seguroVehiculo?: string;
  address?: string;
  addressLat?: number;
  addressLng?: number;
  isDriver?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RegisterBody;
    const {
      name,
      phone,
      email = '',
      dni = '',
      birthday = '',
      dniFront = '',
      dniBack = '',
      facePhoto = '',
      selfieWithDni = '',
      licenseFront = '',
      licenseBack = '',
      // Driver vehicle info (Session 17) — only required if isDriver=true
      vehicleType = '',
      vehiclePlate = '',
      vehicleBrand = '',
      vehicleModel = '',
      vehicleYear,
      vehicleColor = '',
      cedulaVerdeAzul = '',
      cedulaVerdeAzulBack = '',
      seguroVehiculo = '',
      address = '',
      addressLat,
      addressLng,
      isDriver = false,
    } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { error: 'Nombre y teléfono son requeridos' },
        { status: 400 }
      );
    }

    // Normalize phone before any DB operation
    const normalizedPhone = normalizePhone(phone);
    console.log(`[register] phone normalization: "${phone}" → "${normalizedPhone}"`);

    // ── Determine admin status ────────────────────────────────────────────
    // Two ways to become admin:
    // 1. OWNER_PHONE env var matches the registering phone (production)
    // 2. If OWNER_PHONE is NOT set AND no admin exists yet, first user becomes admin (dev/prototype)
    const OWNER_PHONE = process.env.OWNER_PHONE;
    let isAdmin = false;
    if (OWNER_PHONE && normalizedPhone === normalizePhone(OWNER_PHONE)) {
      isAdmin = true;
    } else if (!OWNER_PHONE) {
      const adminCount = await prisma.user.count({ where: { isAdmin: true } });
      if (adminCount === 0) {
        isAdmin = true;
        console.warn(`\n⚠️  [SECURITY] No OWNER_PHONE env var set. Making first user (${normalizedPhone}) an admin.`);
        console.warn(`⚠️  Set OWNER_PHONE in production env vars to lock this down.\n`);
      }
    }

    // ── Generate verification codes ───────────────────────────────────────
    const phoneOtp = generateOtp();
    const phoneOtpExpiresAt = otpExpiry();
    const emailVerifyToken = email ? generateEmailToken() : '';
    const emailVerifyExpiresAt = email ? emailTokenExpiry() : null;

    // ── Upsert user ───────────────────────────────────────────────────────
    const user = await prisma.user.upsert({
      where: { phone: normalizedPhone },
      create: {
        name,
        phone: normalizedPhone,
        email,
        dni,
        birthday,
        dniFront,
        dniBack,
        facePhoto,
        selfieWithDni,
        licenseFront,
        licenseBack,
        // Driver vehicle info (Session 17)
        vehicleType,
        vehiclePlate,
        vehicleBrand,
        vehicleModel,
        vehicleYear: vehicleYear ?? null,
        vehicleColor,
        cedulaVerdeAzul,
        cedulaVerdeAzulBack,
        seguroVehiculo,
        address,
        addressLat: addressLat ?? null,
        addressLng: addressLng ?? null,
        role: 'passenger',
        isDriver,
        isDriverApproved: false,
        isAdmin,
        isSocio: true,  // socios cooperativa = 5% comisión (default para todos los conductores)
        verificationStatus: 'pending',
        // Verification fields
        phoneOtp,
        phoneOtpExpiresAt,
        emailVerifyToken,
        emailVerifyExpiresAt,
        walletBalance: 15000,
      },
      update: {
        name,
        // Only overwrite documents if new ones were provided
        ...(email ? { email } : {}),
        ...(birthday ? { birthday } : {}),
        ...(dni ? { dni } : {}),
        ...(dniFront ? { dniFront } : {}),
        ...(dniBack ? { dniBack } : {}),
        ...(facePhoto ? { facePhoto } : {}),
        ...(selfieWithDni ? { selfieWithDni } : {}),
        ...(licenseFront ? { licenseFront } : {}),
        ...(licenseBack ? { licenseBack } : {}),
        // Driver vehicle info (Session 17) — overwrite only if provided
        ...(vehicleType ? { vehicleType } : {}),
        ...(vehiclePlate ? { vehiclePlate } : {}),
        ...(vehicleBrand ? { vehicleBrand } : {}),
        ...(vehicleModel ? { vehicleModel } : {}),
        ...(vehicleYear != null ? { vehicleYear } : {}),
        ...(vehicleColor ? { vehicleColor } : {}),
        ...(cedulaVerdeAzul ? { cedulaVerdeAzul } : {}),
        ...(cedulaVerdeAzulBack ? { cedulaVerdeAzulBack } : {}),
        ...(seguroVehiculo ? { seguroVehiculo } : {}),
        ...(address ? { address } : {}),
        ...(addressLat != null ? { addressLat } : {}),
        ...(addressLng != null ? { addressLng } : {}),
        isDriver,
        // Preserve isAdmin if user was already admin
        isAdmin: isAdmin || (await prisma.user.findUnique({ where: { phone: normalizedPhone }, select: { isAdmin: true } }))?.isAdmin || false,
        // Re-submitting documents resets verification to pending
        verificationStatus: 'pending',
        // Reset verification codes
        phoneOtp,
        phoneOtpExpiresAt,
        ...(email ? { emailVerifyToken, emailVerifyExpiresAt } : {}),
        // Clear previous verifications if phone/email changed
        phoneVerifiedAt: null,
        ...(email ? { emailVerifiedAt: null } : {}),
      },
    });

    const token = generateToken(user.id);

    // ── Deliver OTP (Telegram preferred → SMS fallback → dev mode) ──
    // For a brand new user we don't have a telegramChatId yet (they need to
    // open the bot first), so this will typically land on SMS or dev mode.
    // Once the user links Telegram via /start, future OTPs go through it.
    const otpResult = await deliverOtp(
      {
        phone: normalizedPhone,
        telegramChatId: user.telegramChatId,
        preferredChannel: (user.otpChannel as 'telegram' | 'sms' | 'whatsapp' | null) ?? 'telegram',
      },
      phoneOtp
    );

    // ── Send verification email (or dev mode) ────────────────────────────
    let emailResult: { success: boolean; devMode: boolean; devLink?: string } | null = null;
    if (email && emailVerifyToken) {
      emailResult = await sendVerificationEmail(email, name, emailVerifyToken);
    }

    return NextResponse.json({
      user: {
        uid: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email || '',
        dni: user.dni || '',
        dniFront: user.dniFront || '',
        dniBack: user.dniBack || '',
        facePhoto: user.facePhoto || '',
        licenseFront: user.licenseFront || '',
        licenseBack: user.licenseBack || '',
        // Driver vehicle info (Session 17)
        vehicleType: user.vehicleType || '',
        vehiclePlate: user.vehiclePlate || '',
        vehicleBrand: user.vehicleBrand || '',
        vehicleModel: user.vehicleModel || '',
        vehicleYear: user.vehicleYear ?? undefined,
        vehicleColor: user.vehicleColor || '',
        cedulaVerdeAzul: user.cedulaVerdeAzul || '',
        cedulaVerdeAzulBack: user.cedulaVerdeAzulBack || '',
        seguroVehiculo: user.seguroVehiculo || '',
        address: user.address || '',
        addressLat: user.addressLat ?? undefined,
        addressLng: user.addressLng ?? undefined,
        avatar: user.avatar || '',
        birthday: user.birthday || '',
        role: user.role,
        isDriver: user.isDriver,
        isDriverApproved: user.isDriverApproved,
        isAdmin: user.isAdmin,
        isSocio: user.isSocio,
        verificationStatus: user.verificationStatus as 'pending' | 'verified' | 'rejected',
        phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
        emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      },
      token,
      // Channel info + dev-mode helpers (only populated when no provider is configured)
      otp: {
        channel: otpResult.channel,
        needsTelegramLink: otpResult.needsTelegramLink,
        telegramBotLink: otpResult.telegramBotLink,
        error: otpResult.error,
      },
      dev: {
        phoneOtp: otpResult.devMode ? phoneOtp : undefined,
        emailVerifyUrl: emailResult?.devMode ? emailResult.devLink : undefined,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
