import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone';

// GET: Lista todos los usuarios con sus teléfonos (para diagnóstico)
// POST: Normaliza todos los teléfonos al formato canónico (+549XXXXXXXXXX)
//
// Protegido por un secreto compartido en el header X-Admin-Key
// para evitar acceso público. Setear ADMIN_KEY en env vars.

const ADMIN_KEY = process.env.ADMIN_KEY || 'unira-admin-debug-2025';

export async function GET(request: NextRequest) {
  const adminKey = request.headers.get('x-admin-key');
  if (adminKey !== ADMIN_KEY) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, phone: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const report = users.map((u) => {
    const normalized = normalizePhone(u.phone || '');
    const needsFix = u.phone !== normalized;
    return {
      id: u.id,
      name: u.name,
      phoneCurrent: u.phone,
      phoneNormalized: normalized,
      needsFix,
      createdAt: u.createdAt.toISOString(),
    };
  });

  return NextResponse.json({
    total: users.length,
    needsFix: report.filter((r) => r.needsFix).length,
    users: report,
  });
}

export async function POST(request: NextRequest) {
  const adminKey = request.headers.get('x-admin-key');
  if (adminKey !== ADMIN_KEY) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, phone: true },
  });

  const results: { id: string; name: string; from: string; to: string; status: string }[] = [];

  for (const u of users) {
    const normalized = normalizePhone(u.phone || '');
    if (u.phone !== normalized) {
      // Verificar que no haya colisión con otro usuario que ya tenga ese formato
      const existing = await prisma.user.findUnique({
        where: { phone: normalized },
        select: { id: true, name: true },
      });
      if (existing && existing.id !== u.id) {
        results.push({
          id: u.id,
          name: u.name,
          from: u.phone || '',
          to: normalized,
          status: `COLISIÓN: ya existe otro usuario (${existing.name}) con ese teléfono`,
        });
        continue;
      }
      try {
        await prisma.user.update({
          where: { id: u.id },
          data: { phone: normalized },
        });
        results.push({
          id: u.id,
          name: u.name,
          from: u.phone || '',
          to: normalized,
          status: 'actualizado',
        });
      } catch (err: unknown) {
        results.push({
          id: u.id,
          name: u.name,
          from: u.phone || '',
          to: normalized,
          status: 'error: ' + (err instanceof Error ? err.message : String(err)),
        });
      }
    } else {
      results.push({
        id: u.id,
        name: u.name,
        from: u.phone || '',
        to: normalized,
        status: 'sin cambios (ya normalizado)',
      });
    }
  }

  return NextResponse.json({
    total: users.length,
    updated: results.filter((r) => r.status === 'actualizado').length,
    results,
  });
}
