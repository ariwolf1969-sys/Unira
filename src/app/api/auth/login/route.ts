import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { normalizePhone } from '@/lib/phone';

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

    const normalizedPhone = normalizePhone(phone);
    console.log(`[login] phone normalization: "${phone}" → "${normalizedPhone}"`);

    // Si la normalización falla, intentar también buscar por variantes comunes
    // (por si el teléfono se guardó con un formato distinto en registros antiguos)
    let user = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
    });

    // Fallback: si no se encuentra, buscar por variantes (legado)
    if (!user) {
      const digits = phone.replace(/\D/g, '');
      const variants = new Set<string>([normalizedPhone]);
      // +54 sin el 9 (formato fijo)
      if (digits.startsWith('549')) {
        variants.add('+54' + digits.slice(3));
      } else if (digits.startsWith('54')) {
        variants.add('+54' + digits.slice(2));
        variants.add('+549' + digits.slice(2));
      } else {
        variants.add('+54' + digits);
        variants.add('+549' + digits);
      }
      // Quitar la versión canónica ya probada
      variants.delete(normalizedPhone);

      for (const v of variants) {
        const u = await prisma.user.findUnique({ where: { phone: v } });
        if (u) {
          // Encontramos al usuario con un formato legacy. Migrarlo al formato canónico.
          console.log(`[login] usuario encontrado con formato legacy "${v}", migrando a "${normalizedPhone}"`);
          await prisma.user.update({
            where: { id: u.id },
            data: { phone: normalizedPhone },
          });
          user = { ...u, phone: normalizedPhone };
          break;
        }
      }
    }

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
        dniFront: user.dniFront || '',
        dniBack: user.dniBack || '',
        facePhoto: user.facePhoto || '',
        selfieWithDni: user.selfieWithDni || '',
        licenseFront: user.licenseFront || '',
        licenseBack: user.licenseBack || '',
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
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
