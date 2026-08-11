import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Migration endpoint for rewards/points system.
 * Adds rewardPoints, rewardLevel, rewardLevelUpdatedAt columns to User,
 * and creates RewardLog and RewardTier tables with default tiers.
 *
 * POST /api/admin/migrate-rewards
 */
export async function POST() {
  try {
    const dbUrl = process.env.DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!dbUrl || !authToken) {
      return NextResponse.json({ error: 'Missing DATABASE_URL or TURSO_AUTH_TOKEN' }, { status: 500 });
    }

    const { createClient } = await import('@libsql/client');
    const client = createClient({ url: dbUrl, authToken });

    const statements = [
      // Add reward columns to User
      "ALTER TABLE User ADD COLUMN rewardPoints INTEGER NOT NULL DEFAULT 0;",
      "ALTER TABLE User ADD COLUMN rewardLevel TEXT NOT NULL DEFAULT 'bronze';",
      "ALTER TABLE User ADD COLUMN rewardLevelUpdatedAt DATETIME;",

      // Reward log table
      `CREATE TABLE IF NOT EXISTS RewardLog (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)) || '-' || hex(randomblob(4)))),
        userId TEXT NOT NULL,
        points INTEGER NOT NULL,
        reason TEXT NOT NULL,
        referenceId TEXT DEFAULT '',
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,

      // Reward tiers config table
      `CREATE TABLE IF NOT EXISTS RewardTier (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)) || '-' || hex(randomblob(4)))),
        level TEXT NOT NULL UNIQUE,
        minPoints INTEGER NOT NULL,
        benefits TEXT NOT NULL DEFAULT '[]',
        discountPercent INTEGER NOT NULL DEFAULT 0,
        freeTripsPerMonth INTEGER NOT NULL DEFAULT 0,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,

      // Seed default tiers
      `INSERT OR IGNORE INTO RewardTier (id, level, minPoints, benefits, discountPercent, freeTripsPerMonth) VALUES
        ('tier_bronze', 'bronze', 0, '["5% de descuento en compras comunitarias","Acceso a sorteos mensuales"]', 5, 0),
        ('tier_silver', 'silver', 25, '["10% de descuento en compras comunitarias","1 viaje gratis por mes","Prioridad en horas pico"]', 10, 1),
        ('tier_gold', 'gold', 75, '["15% de descuento en compras comunitarias","3 viajes gratis por mes","Soporte prioritario","Invitaciones a eventos"]', 15, 3),
        ('tier_platinum', 'platinum', 200, '["20% de descuento en compras comunitarias","5 viajes gratis por mes","Atención personalizada","Voto en asambleas de cooperativa","Regalo de cumpleaños"]', 20, 5)`,
    ];

    const results: Array<{ sql: string; status: string; error?: string }> = [];
    for (const sql of statements) {
      try {
        await client.execute(sql);
        results.push({ sql, status: 'ok' });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('duplicate column name') || msg.includes('already exists')) {
          results.push({ sql, status: 'already_exists' });
        } else {
          results.push({ sql, status: 'error', error: msg });
        }
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('[migrate-rewards] error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
