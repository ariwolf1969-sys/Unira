import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const adminUserId = searchParams.get('adminUserId');

    // Auth check — require admin
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

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        dni: true,
        birthday: true,
        address: true,
        addressLat: true,
        addressLng: true,
        role: true,
        isDriver: true,
        isDriverApproved: true,
        isAdmin: true,
        isSocio: true,
        verificationStatus: true,
        phoneVerifiedAt: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
        // ── Document photos ──
        dniFront: true,
        dniBack: true,
        facePhoto: true,
        selfieWithDni: true,
        // ── Driver documents ──
        licenseFront: true,
        licenseBack: true,
        vehicleType: true,
        vehiclePlate: true,
        vehicleBrand: true,
        vehicleModel: true,
        vehicleYear: true,
        vehicleColor: true,
        cedulaVerdeAzul: true,
        cedulaVerdeAzulBack: true,
        seguroVehiculo: true,
        // ── Expiration dates ──
        licenseExpiryDate: true,
        seguroExpiryDate: true,
        cedulaExpiryDate: true,
        // ── Driver config (fetched separately) ──
        // ── Stats ──
        tripCountAsPassenger: true,
        tripCountAsDriver: true,
        totalSpent: true,
        totalEarned: true,
        averageRating: true,
        ratingCount: true,
        walletBalance: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Fetch driver config separately (no FK relation in schema)
    let driverConfig = null;
    if (user.isDriver) {
      driverConfig = await prisma.driverConfig.findUnique({
        where: { userId: id },
        select: {
          maxPickupKm: true,
          minFare: true,
          minPerKm: true,
          autoAccept: true,
          genderPreference: true,
          driverGender: true,
          tripPreferences: true,
          smokingAllowed: true,
          petsAllowed: true,
          musicAllowed: true,
          prefersSilence: true,
          hasAC: true,
          cbuNumber: true,
          cbuAlias: true,
          cbuHolderName: true,
        },
      });
    }

    return NextResponse.json({ user: { ...user, driverConfig } });
  } catch (error) {
    console.error('Admin user detail error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
