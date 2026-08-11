import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { DriverConfig as DriverConfigRow } from '@prisma/client';

export const runtime = 'nodejs';

// Default config returned when no row exists yet (or on transient errors).
function defaultConfig(userId: string) {
  return {
    userId,
    maxPickupKm: 10,
    minFare: 0,
    minPerKm: 0,
    minPassengerRating: 0,
    autoAccept: false,
    schedule: [],
    preferredZones: [],
    radarAlertsEnabled: true,
    radarAlertRadius: 300,
    destinationModeEnabled: false,
    destinationAddress: '',
    destinationLat: 0,
    destinationLng: 0,
    destinationRadiusKm: 4,
    acceptedPaymentMethods: [],
    cbuAlias: '',
    cbuNumber: '',
    cbuHolderName: '',
    // New preferences
    genderPreference: 'any',
    tripPreferences: [],
    smokingAllowed: false,
    petsAllowed: true,
    musicAllowed: true,
    prefersSilence: false,
    hasAC: true,
    driverGender: '',
    minDriverRating: 0,
    communicationPreference: 'both',
  };
}

// GET /api/driver-config?userId=...
// Returns the driver's config. If none exists, returns defaults.
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId requerido' }, { status: 400 });
    }

    let config: DriverConfigRow | null = null;
    try {
      config = await prisma.driverConfig.findUnique({ where: { userId } });
    } catch (dbErr) {
      // DriverConfig table might not exist yet on the production Turso DB.
      // Return defaults with a `degraded` flag instead of a 500 so the screen
      // loads — but log loudly so the operator knows to push the schema.
      console.error('[driver-config] GET prisma error (schema not synced?):', dbErr);
      return NextResponse.json({
        config: defaultConfig(userId),
        isNew: true,
        degraded: true,
      });
    }

    if (!config) {
      return NextResponse.json({ config: defaultConfig(userId), isNew: true });
    }

    return NextResponse.json({
      config: {
        userId: config.userId,
        maxPickupKm: config.maxPickupKm,
        minFare: config.minFare,
        minPerKm: config.minPerKm,
        minPassengerRating: config.minPassengerRating ?? 0,
        autoAccept: config.autoAccept,
        schedule: safeParse(config.schedule, []),
        preferredZones: safeParse(config.preferredZones, []),
        radarAlertsEnabled: config.radarAlertsEnabled,
        radarAlertRadius: config.radarAlertRadius,
        destinationModeEnabled: config.destinationModeEnabled,
        destinationAddress: config.destinationAddress,
        destinationLat: config.destinationLat,
        destinationLng: config.destinationLng,
        destinationRadiusKm: config.destinationRadiusKm,
        acceptedPaymentMethods: safeParse(config.acceptedPaymentMethods, []),
        cbuAlias: config.cbuAlias || '',
        cbuNumber: config.cbuNumber || '',
        cbuHolderName: config.cbuHolderName || '',
        // New preferences
        genderPreference: config.genderPreference || 'any',
        tripPreferences: safeParse(config.tripPreferences, []),
        smokingAllowed: config.smokingAllowed ?? false,
        petsAllowed: config.petsAllowed ?? true,
        musicAllowed: config.musicAllowed ?? true,
        prefersSilence: config.prefersSilence ?? false,
        hasAC: config.hasAC ?? true,
        driverGender: config.driverGender || '',
        minDriverRating: config.minDriverRating ?? 0,
        communicationPreference: config.communicationPreference || 'both',
      },
      isNew: false,
    });
  } catch (error) {
    console.error('GET /api/driver-config error:', error);
    return NextResponse.json(
      { error: 'Error al cargar la configuración', config: defaultConfig(request.nextUrl.searchParams.get('userId') || '') },
      { status: 500 }
    );
  }
}

interface PatchBody {
  userId: string;
  maxPickupKm?: number;
  minFare?: number;
  minPerKm?: number;
  minPassengerRating?: number;
  autoAccept?: boolean;
  schedule?: unknown;
  preferredZones?: unknown;
  radarAlertsEnabled?: boolean;
  radarAlertRadius?: number;
  destinationModeEnabled?: boolean;
  destinationAddress?: string;
  destinationLat?: number;
  destinationLng?: number;
  destinationRadiusKm?: number;
  acceptedPaymentMethods?: unknown;
  cbuAlias?: string;
  cbuNumber?: string;
  cbuHolderName?: string;
  // New preferences
  genderPreference?: string;
  tripPreferences?: unknown;
  smokingAllowed?: boolean;
  petsAllowed?: boolean;
  musicAllowed?: boolean;
  prefersSilence?: boolean;
  hasAC?: boolean;
  driverGender?: string;
  minDriverRating?: number;
  communicationPreference?: string;
}

// PATCH /api/driver-config
// Upserts the driver's config. Only fields present in the body are updated.
export async function PATCH(request: NextRequest) {
  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const { userId } = body;
  if (!userId) {
    return NextResponse.json({ error: 'userId requerido' }, { status: 400 });
  }

  // Verify the user is actually a driver
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isDriver: true, isDriverApproved: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }
    if (!user.isDriver) {
      return NextResponse.json(
        { error: 'El usuario no está registrado como conductor' },
        { status: 403 }
      );
    }
  } catch (userErr) {
    console.error('[driver-config] PATCH user lookup error:', userErr);
    return NextResponse.json(
      { error: 'No se pudo verificar el conductor (base de datos no disponible)' },
      { status: 500 }
    );
  }

  const data: Record<string, unknown> = {};
  if (typeof body.maxPickupKm === 'number' && body.maxPickupKm >= 0 && body.maxPickupKm <= 100) {
    data.maxPickupKm = body.maxPickupKm;
  }
  if (typeof body.minFare === 'number' && body.minFare >= 0) {
    data.minFare = body.minFare;
  }
  if (typeof body.minPerKm === 'number' && body.minPerKm >= 0) {
    data.minPerKm = body.minPerKm;
  }
  if (typeof body.minPassengerRating === 'number' && body.minPassengerRating >= 0 && body.minPassengerRating <= 5) {
    data.minPassengerRating = body.minPassengerRating;
  }
  if (typeof body.autoAccept === 'boolean') {
    data.autoAccept = body.autoAccept;
  }
  if (Array.isArray(body.schedule)) {
    data.schedule = JSON.stringify(body.schedule);
  }
  if (Array.isArray(body.preferredZones)) {
    data.preferredZones = JSON.stringify(body.preferredZones);
  }
  if (typeof body.radarAlertsEnabled === 'boolean') {
    data.radarAlertsEnabled = body.radarAlertsEnabled;
  }
  if (typeof body.radarAlertRadius === 'number' && body.radarAlertRadius >= 100 && body.radarAlertRadius <= 2000) {
    data.radarAlertRadius = body.radarAlertRadius;
  }
  if (typeof body.destinationModeEnabled === 'boolean') {
    data.destinationModeEnabled = body.destinationModeEnabled;
  }
  if (typeof body.destinationAddress === 'string') {
    data.destinationAddress = body.destinationAddress.slice(0, 200);
  }
  if (typeof body.destinationLat === 'number') {
    data.destinationLat = body.destinationLat;
  }
  if (typeof body.destinationLng === 'number') {
    data.destinationLng = body.destinationLng;
  }
  if (typeof body.destinationRadiusKm === 'number' && body.destinationRadiusKm >= 1 && body.destinationRadiusKm <= 20) {
    data.destinationRadiusKm = body.destinationRadiusKm;
  }
  if (Array.isArray(body.acceptedPaymentMethods)) {
    const valid = body.acceptedPaymentMethods.filter(
      (m): m is 'cash' | 'credit_card' | 'debit_card' =>
        m === 'cash' || m === 'credit_card' || m === 'debit_card'
    );
    data.acceptedPaymentMethods = JSON.stringify(valid);
  }
  // ── New preference fields ──
  if (typeof body.genderPreference === 'string') {
    const valid = ['any', 'male', 'female'];
    if (valid.includes(body.genderPreference)) {
      data.genderPreference = body.genderPreference;
    }
  }
  if (Array.isArray(body.tripPreferences)) {
    const allowed = ['ac', 'radio', 'silence', 'smoking', 'pets', 'front_seat', 'luggage', 'children'];
    data.tripPreferences = JSON.stringify(body.tripPreferences.filter((p: string) => allowed.includes(p)));
  }
  if (typeof body.smokingAllowed === 'boolean') {
    data.smokingAllowed = body.smokingAllowed;
  }
  if (typeof body.petsAllowed === 'boolean') {
    data.petsAllowed = body.petsAllowed;
  }
  if (typeof body.musicAllowed === 'boolean') {
    data.musicAllowed = body.musicAllowed;
  }
  if (typeof body.prefersSilence === 'boolean') {
    data.prefersSilence = body.prefersSilence;
  }
  if (typeof body.hasAC === 'boolean') {
    data.hasAC = body.hasAC;
  }
  if (typeof body.driverGender === 'string') {
    data.driverGender = body.driverGender.trim().slice(0, 20);
  }
  if (typeof body.minDriverRating === 'number' && body.minDriverRating >= 0 && body.minDriverRating <= 5) {
    data.minDriverRating = body.minDriverRating;
  }
  if (typeof body.communicationPreference === 'string') {
    const valid = ['both', 'calls', 'messages'];
    if (valid.includes(body.communicationPreference)) {
      data.communicationPreference = body.communicationPreference;
    }
  }
  // ── CBU/CVU fields ──
  // cbuNumber: normalizamos a solo dígitos, validamos longitud 22 (CBU AR)
  if (typeof body.cbuNumber === 'string') {
    const digits = body.cbuNumber.replace(/\D/g, '');
    if (digits.length === 0 || digits.length === 22) {
      data.cbuNumber = digits;
    } else if (digits.length > 0 && digits.length < 22) {
      return NextResponse.json(
        { ok: false, error: 'El CBU/CVU debe tener 22 dígitos.' },
        { status: 400 }
      );
    }
  }
  if (typeof body.cbuAlias === 'string') {
    data.cbuAlias = body.cbuAlias.trim().slice(0, 50);
  }
  if (typeof body.cbuHolderName === 'string') {
    data.cbuHolderName = body.cbuHolderName.trim().slice(0, 100);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true, changed: false });
  }

  try {
    const config = await prisma.driverConfig.upsert({
      where: { userId },
      create: {
        userId,
        ...data,
      },
      update: data,
    });

    return NextResponse.json({
      ok: true,
      changed: true,
      config: {
        userId: config.userId,
        maxPickupKm: config.maxPickupKm,
        minFare: config.minFare,
        minPerKm: config.minPerKm,
        minPassengerRating: config.minPassengerRating ?? 0,
        autoAccept: config.autoAccept,
        schedule: safeParse(config.schedule, []),
        preferredZones: safeParse(config.preferredZones, []),
        radarAlertsEnabled: config.radarAlertsEnabled,
        radarAlertRadius: config.radarAlertRadius,
        destinationModeEnabled: config.destinationModeEnabled,
        destinationAddress: config.destinationAddress,
        destinationLat: config.destinationLat,
        destinationLng: config.destinationLng,
        destinationRadiusKm: config.destinationRadiusKm,
        acceptedPaymentMethods: safeParse(config.acceptedPaymentMethods, []),
        cbuAlias: config.cbuAlias || '',
        cbuNumber: config.cbuNumber || '',
        cbuHolderName: config.cbuHolderName || '',
        // New preferences
        genderPreference: config.genderPreference || 'any',
        tripPreferences: safeParse(config.tripPreferences, []),
        smokingAllowed: config.smokingAllowed ?? false,
        petsAllowed: config.petsAllowed ?? true,
        musicAllowed: config.musicAllowed ?? true,
        prefersSilence: config.prefersSilence ?? false,
        hasAC: config.hasAC ?? true,
        driverGender: config.driverGender || '',
        minDriverRating: config.minDriverRating ?? 0,
        communicationPreference: config.communicationPreference || 'both',
      },
    });
  } catch (error) {
    // CRITICAL FIX: Previously this returned `ok: true` even on DB failure,
    // which made the UI say "Guardado" while nothing was actually persisted.
    // Now we surface the error so the user knows the save failed (typically
    // because the DriverConfig table doesn't exist in production Turso yet —
    // operator must run `prisma db push`).
    console.error('PATCH /api/driver-config prisma error:', error);
    const errMsg = error instanceof Error ? error.message : 'Error desconocido';
    const isSchemaError =
      errMsg.includes('does not exist') ||
      errMsg.includes('no existe') ||
      errMsg.includes('UNKNOWN_TABLE') ||
      errMsg.includes('table') ||
      errMsg.includes('column');
    return NextResponse.json(
      {
        ok: false,
        changed: false,
        error: isSchemaError
          ? 'La tabla de configuración no existe en el servidor. El administrador debe ejecutar `prisma db push` contra Turso.'
          : 'No se pudo guardar la configuración en el servidor.',
        detail: errMsg,
      },
      { status: 500 }
    );
  }
}

function safeParse<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
