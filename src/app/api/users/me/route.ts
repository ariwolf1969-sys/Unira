import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * GET /api/users/me?userId=xxx
 * Returns the user's full profile + recomputed stats (trip counts, total spent, total earned, avg rating).
 * Also handles birthday bonus logic: if today is the user's birthday and bonus wasn't granted this year,
 * grants a $1.000 credit to the wallet and records a WalletMovement.
 *
 * Response shape:
 * {
 *   user: { ...all fields... },
 *   stats: {
 *     tripsAsPassenger: number,
 *     tripsAsDriver: number,
 *     totalSpent: number,
 *     totalEarned: number,
 *     averageRating: number,   // 0-5
 *     ratingCount: number,
 *     upcomingBirthday: string | null,  // ISO date or null
 *     daysUntilBirthday: number | null,
 *   },
 *   wallet: { balance: number, lastMovements: WalletMovement[] },
 *   birthdayBonus: { granted: boolean, amount?: number } | null
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId requerido' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        walletMovements: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // ── Recompute stats from Trip table ──────────────────────────────────
    const [tripCountAsPassenger, tripCountAsDriver, totalSpentAgg, totalEarnedAgg, ratingsAgg] =
      await Promise.all([
        prisma.trip.count({
          where: { userId, status: 'completed', type: 'ride' },
        }),
        prisma.trip.count({
          where: { driverId: userId, status: 'completed', type: 'ride' },
        }),
        prisma.trip.aggregate({
          where: { userId, status: 'completed', type: 'ride' },
          _sum: { fare: true },
        }),
        prisma.trip.aggregate({
          where: { driverId: userId, status: 'completed', type: 'ride' },
          _sum: { fare: true },
        }),
        prisma.rating.aggregate({
          where: { toUserId: userId, visibleToRecipientAt: { lte: new Date() } },
          _avg: { stars: true },
          _count: { stars: true },
        }),
      ]);

    const totalSpent = totalSpentAgg._sum.fare ?? 0;
    const totalEarned = totalEarnedAgg._sum.fare ?? 0;
    const avgRating = ratingsAgg._avg.stars ?? 0;
    const ratingCount = ratingsAgg._count.stars ?? 0;

    // ── Update denormalized stats if they changed (best-effort, non-blocking) ──
    if (
      user.tripCountAsPassenger !== tripCountAsPassenger ||
      user.tripCountAsDriver !== tripCountAsDriver ||
      user.totalSpent !== totalSpent ||
      user.totalEarned !== totalEarned ||
      Math.abs((user.averageRating ?? 0) - avgRating) > 0.01 ||
      user.ratingCount !== ratingCount
    ) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          tripCountAsPassenger,
          tripCountAsDriver,
          totalSpent,
          totalEarned,
          averageRating: avgRating,
          ratingCount,
        },
      });
    }

    // ── Birthday bonus logic ─────────────────────────────────────────────
    let birthdayBonus: { granted: boolean; amount?: number } | null = null;
    let upcomingBirthday: string | null = null;
    let daysUntilBirthday: number | null = null;

    if (user.birthday) {
      const today = new Date();
      const [yearStr, monthStr, dayStr] = user.birthday.split('-');
      const month = parseInt(monthStr, 10);
      const day = parseInt(dayStr, 10);
      if (month && day) {
        // Next birthday (this year or next year)
        const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        let nextBirthday = new Date(today.getFullYear(), month - 1, day);
        if (nextBirthday < todayMidnight) {
          nextBirthday = new Date(today.getFullYear() + 1, month - 1, day);
        }
        const msPerDay = 1000 * 60 * 60 * 24;
        daysUntilBirthday = Math.ceil((nextBirthday.getTime() - todayMidnight.getTime()) / msPerDay);
        upcomingBirthday = nextBirthday.toISOString();

        // Is today the birthday?
        const isBirthdayToday =
          today.getMonth() === month - 1 && today.getDate() === day;

        const currentYear = today.getFullYear();
        if (isBirthdayToday && user.birthdayBonusGrantedYear < currentYear) {
          // Grant $1.000 bonus
          const bonusAmount = 1000;
          await prisma.$transaction([
            prisma.user.update({
              where: { id: userId },
              data: {
                walletBalance: { increment: bonusAmount },
                birthdayBonusGrantedYear: currentYear,
              },
            }),
            prisma.walletMovement.create({
              data: {
                userId,
                type: 'cashback',
                amount: bonusAmount,
                description: '¡Feliz cumpleaños! Regalo de Unira',
                balance: user.walletBalance + bonusAmount,
              },
            }),
          ]);
          birthdayBonus = { granted: true, amount: bonusAmount };
        }
      }
    }

    // ── Build response (omit photos to keep payload small) ──
    const {
      dniFront: _f1,
      dniBack: _f2,
      facePhoto: _f3,
      licenseFront: _f4,
      licenseBack: _f5,
      phoneOtp: _o1,
      emailVerifyToken: _o2,
      ...safeUser
    } = user;

    return NextResponse.json({
      user: {
        ...safeUser,
        // Ensure these match what the client expects
        phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
        emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      },
      stats: {
        tripsAsPassenger: tripCountAsPassenger,
        tripsAsDriver: tripCountAsDriver,
        totalSpent,
        totalEarned,
        averageRating: Math.round(avgRating * 10) / 10,
        ratingCount,
        upcomingBirthday,
        daysUntilBirthday,
      },
      wallet: {
        balance: user.walletBalance,
        lastMovements: user.walletMovements.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
        })),
      },
      birthdayBonus,
    });
  } catch (error) {
    console.error('Get /api/users/me error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/users/me ─────────────────────────────────────────────────────

interface PatchBody {
  userId?: string;
  name?: string;
  email?: string;
  address?: string;
  addressLat?: number;
  addressLng?: number;
  avatar?: string;
  birthday?: string;
  // ── UI role preference (passenger | driver) — persisted so it survives reloads ──
  role?: 'passenger' | 'driver';
  // Permissions onboarding (Grupo F)
  cameraConsent?: boolean;
  microphoneConsent?: boolean;
  notificationsConsent?: boolean;
  locationConsent?: boolean;
  permissionsOnboardedAt?: string;
  // ── Terms & Conditions ──
  termsAcceptedAt?: string;
  termsVersion?: string;
  recordingConsentGlobal?: boolean;
  // ── Push notifications (FCM) ──
  pushToken?: string;
}

/**
 * PATCH /api/users/me
 * Updates editable user fields. Phone and DNI are NOT editable here
 * (they require re-verification flow).
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as PatchBody;
    const {
      userId,
      name,
      email,
      address,
      addressLat,
      addressLng,
      avatar,
      birthday,
      role,
      cameraConsent,
      microphoneConsent,
      notificationsConsent,
      locationConsent,
      permissionsOnboardedAt,
      termsAcceptedAt,
      termsVersion,
      recordingConsentGlobal,
      pushToken,
    } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId requerido' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerifiedAt: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if (typeof name === 'string' && name.trim()) {
      data.name = name.trim();
    }

    if (typeof email === 'string' && email.trim() && email !== existing.email) {
      // Email changed: must re-verify
      data.email = email.trim();
      data.emailVerifiedAt = null;
    }

    if (typeof address === 'string') {
      data.address = address;
    }
    if (typeof addressLat === 'number') {
      data.addressLat = addressLat;
    }
    if (typeof addressLng === 'number') {
      data.addressLng = addressLng;
    }
    if (typeof avatar === 'string') {
      data.avatar = avatar;
    }
    if (typeof birthday === 'string' && birthday.trim()) {
      data.birthday = birthday.trim();
    }

    // ── UI role preference (passenger | driver) ──
    // Persisted server-side so the user's last-chosen mode is the default
    // when they reload the app. The local client value is still authoritative
    // for the current session (see syncProfileFromServer in store.ts).
    if (role === 'passenger' || role === 'driver') {
      data.role = role;
    }

    // ── Permissions (Grupo F) ──
    if (typeof cameraConsent === 'boolean') data.cameraConsent = cameraConsent;
    if (typeof microphoneConsent === 'boolean') data.microphoneConsent = microphoneConsent;
    if (typeof notificationsConsent === 'boolean') data.notificationsConsent = notificationsConsent;
    if (typeof locationConsent === 'boolean') data.locationConsent = locationConsent;

    // Mark onboarding complete (server timestamp takes precedence)
    if (permissionsOnboardedAt === 'now' || permissionsOnboardedAt === 'true') {
      data.permissionsOnboardedAt = new Date();
    } else if (typeof permissionsOnboardedAt === 'string' && permissionsOnboardedAt) {
      data.permissionsOnboardedAt = new Date(permissionsOnboardedAt);
    }

    // ── Terms & Conditions acceptance ──
    if (termsAcceptedAt === 'now' || termsAcceptedAt === 'true') {
      data.termsAcceptedAt = new Date();
    } else if (typeof termsAcceptedAt === 'string' && termsAcceptedAt) {
      data.termsAcceptedAt = new Date(termsAcceptedAt);
    }
    if (typeof termsVersion === 'string' && termsVersion.trim()) {
      data.termsVersion = termsVersion.trim().slice(0, 20);
    }
    if (typeof recordingConsentGlobal === 'boolean') {
      data.recordingConsentGlobal = recordingConsentGlobal;
    }

    // ── Push token (FCM) ──
    if (typeof pushToken === 'string' && pushToken.trim()) {
      data.pushToken = pushToken.trim();
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: true, changed: false });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        address: true,
        addressLat: true,
        addressLng: true,
        avatar: true,
        birthday: true,
        emailVerifiedAt: true,
        permissionsOnboardedAt: true,
        cameraConsent: true,
        microphoneConsent: true,
        notificationsConsent: true,
        locationConsent: true,
      },
    });

    return NextResponse.json({
      ok: true,
      changed: true,
      user: {
        ...updated,
        emailVerifiedAt: updated.emailVerifiedAt?.toISOString() ?? null,
        permissionsOnboardedAt: updated.permissionsOnboardedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error('PATCH /api/users/me error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
