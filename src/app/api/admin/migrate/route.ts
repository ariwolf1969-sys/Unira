import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const dbUrl = process.env.DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!dbUrl || !authToken) {
      return NextResponse.json({ error: 'Missing DATABASE_URL or TURSO_AUTH_TOKEN' }, { status: 500 });
    }

    // Use Turso's native libsql client directly for raw SQL
    const { createClient } = await import('@libsql/client');
    const client = createClient({ url: dbUrl, authToken });

    const alterStatements = [
      // Phase 1: Expiration dates
      "ALTER TABLE User ADD COLUMN licenseExpiryDate TEXT DEFAULT '';",
      "ALTER TABLE User ADD COLUMN seguroExpiryDate TEXT DEFAULT '';",
      "ALTER TABLE User ADD COLUMN cedulaExpiryDate TEXT DEFAULT '';",
      // Phase 2: Queue system tables
      `CREATE TABLE IF NOT EXISTS QueueLocation (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)) || '-' || hex(randomblob(4)))),
        name TEXT NOT NULL,
        address TEXT NOT NULL DEFAULT '',
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        radiusMeters INTEGER NOT NULL DEFAULT 500,
        maxQueueSize INTEGER NOT NULL DEFAULT 100,
        isActive INTEGER NOT NULL DEFAULT 1,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS QueueEntry (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)) || '-' || hex(randomblob(4)))),
        driverId TEXT NOT NULL,
        locationId TEXT NOT NULL,
        position INTEGER NOT NULL,
        joinedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        estimatedWaitMinutes INTEGER NOT NULL DEFAULT 0,
        assignedAt DATETIME,
        status TEXT NOT NULL DEFAULT 'waiting',
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (locationId) REFERENCES QueueLocation(id)
      )`,
      // Seed queue locations if empty
      `INSERT OR IGNORE INTO QueueLocation (id, name, address, lat, lng, radiusMeters, maxQueueSize) VALUES
        ('aeroparque', 'Aeroparque Jorge Newbery', 'Av. Rafael Obligado s/n, CABA', -34.5586, -58.4169, 500, 100),
        ('ezeiza', 'Aeropuerto Ezeiza', 'Autopista Tte. Gral. Ricchieri Km 33.5, Ezeiza', -34.8193, -58.5396, 800, 100)`,
      // Phase 3: Reward points system
      "ALTER TABLE User ADD COLUMN rewardPoints INTEGER NOT NULL DEFAULT 0;",
      "ALTER TABLE User ADD COLUMN rewardLevel TEXT NOT NULL DEFAULT 'bronze';",
      "ALTER TABLE User ADD COLUMN rewardLevelUpdatedAt DATETIME;",
      `CREATE TABLE IF NOT EXISTS RewardLog (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)) || '-' || hex(randomblob(4)))),
        userId TEXT NOT NULL,
        points INTEGER NOT NULL,
        reason TEXT NOT NULL,
        referenceId TEXT DEFAULT '',
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
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
      `INSERT OR IGNORE INTO RewardTier (id, level, minPoints, benefits, discountPercent, freeTripsPerMonth) VALUES
        ('tier_bronze', 'bronze', 0, '["5% de descuento en compras comunitarias","Acceso a sorteos mensuales"]', 5, 0),
        ('tier_silver', 'silver', 25, '["10% de descuento en compras comunitarias","1 viaje gratis por mes","Prioridad en horas pico"]', 10, 1),
        ('tier_gold', 'gold', 75, '["15% de descuento en compras comunitarias","3 viajes gratis por mes","Soporte prioritario","Invitaciones a eventos"]', 15, 3),
        ('tier_platinum', 'platinum', 200, '["20% de descuento en compras comunitarias","5 viajes gratis por mes","Atención personalizada","Voto en asambleas de cooperativa","Regalo de cumpleaños"]', 20, 5)`,
      // Phase 4: GPS trace collection for custom routing & traffic
      `CREATE TABLE IF NOT EXISTS LocationTrace (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        tripId TEXT DEFAULT '',
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        speed REAL DEFAULT 0,
        heading REAL DEFAULT 0,
        accuracy REAL DEFAULT 0,
        altitude REAL DEFAULT 0,
        createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_trace_user_time ON LocationTrace(userId, createdAt)`,
      `CREATE INDEX IF NOT EXISTS idx_trace_trip ON LocationTrace(tripId)`,
      `CREATE INDEX IF NOT EXISTS idx_trace_time ON LocationTrace(createdAt)`,
    ];

    const results: Array<{ sql: string; status: string; error?: string }> = [];
    for (const sql of alterStatements) {
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
    console.error('Migration error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
