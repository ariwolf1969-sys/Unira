import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'unira2026';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const password = searchParams.get('password') || '';

    if (password !== DASHBOARD_PASSWORD) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 401 });
    }

    const section = searchParams.get('section') || 'all';
    const results: Record<string, unknown> = {};

    // === APP USERS (Turso) ===
    if (section === 'all' || section === 'users') {
      try {
        const users = await prisma.user.findMany({
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            dni: true,
            role: true,
            isDriver: true,
            isDriverApproved: true,
            isSocio: true,
            isAdmin: true,
            verificationStatus: true,
            phoneVerifiedAt: true,
            emailVerifiedAt: true,
            walletBalance: true,
            tripCountAsPassenger: true,
            tripCountAsDriver: true,
            totalSpent: true,
            totalEarned: true,
            averageRating: true,
            rewardPoints: true,
            rewardLevel: true,
            // Documents
            dniFront: true,
            dniBack: true,
            facePhoto: true,
            selfieWithDni: true,
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
            licenseExpiryDate: true,
            seguroExpiryDate: true,
            cedulaExpiryDate: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 200,
        });

        const [allUsers, pendingUsers, verifiedUsers, rejectedUsers, driverCount, approvedDrivers] = await Promise.all([
          prisma.user.count(),
          prisma.user.count({ where: { verificationStatus: 'pending' } }),
          prisma.user.count({ where: { verificationStatus: 'verified' } }),
          prisma.user.count({ where: { verificationStatus: 'rejected' } }),
          prisma.user.count({ where: { isDriver: true } }),
          prisma.user.count({ where: { isDriver: true, isDriverApproved: true } }),
        ]);

        results.users = users.map((u) => ({
          ...u,
          source: 'app',
        }));
        results.userStats = {
          total: allUsers,
          pending: pendingUsers,
          verified: verifiedUsers,
          rejected: rejectedUsers,
          drivers: driverCount,
          approvedDrivers,
        };
      } catch (err) {
        console.error('Dashboard users error:', err);
        results.users = [];
        results.usersError = String(err);
      }
    }

    // === SOCIOS POTENCIALES (Supabase) ===
    if (section === 'all' || section === 'socios') {
      const supabaseUrl = 'https://dqmpdzucmvockxzkizbi.supabase.co';
      const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

      if (supabaseKey) {
        try {
          const resp = await fetch(
            `${supabaseUrl}/rest/v1/socios_potenciales?select=*&order=created_at.desc&limit=200`,
            {
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
              },
            }
          );
          if (resp.ok) {
            const socios = await resp.json();
            results.socios = socios.map((s: Record<string, unknown>) => ({
              ...s,
              source: 'web',
            }));
            results.sociosTotal = socios.length;
          } else {
            results.socios = [];
            results.sociosError = `Supabase ${resp.status}: ${await resp.text()}`;
          }
        } catch (err) {
          results.socios = [];
          results.sociosError = String(err);
        }
      } else {
        results.socios = [];
        results.sociosError = 'SUPABASE_ANON_KEY no configurada en Vercel';
      }
    }

    // === TRIPS ===
    if (section === 'all' || section === 'trips') {
      try {
        const totalTrips = await prisma.trip.count();
        const recentTrips = await prisma.trip.findMany({
          select: {
            id: true,
            passengerId: true,
            driverId: true,
            origin: true,
            destination: true,
            fareAmount: true,
            status: true,
            vehicleType: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });
        results.trips = recentTrips;
        results.tripsTotal = totalTrips;
      } catch (err) {
        console.error('Dashboard trips error:', err);
        results.trips = [];
        results.tripsTotal = 0;
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + String(error) },
      { status: 500 }
    );
  }
}
