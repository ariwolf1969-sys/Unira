import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const MIGRATIONS = [
  { table: 'DriverConfig', column: 'genderPreference', type: 'TEXT DEFAULT "any"' },
  { table: 'DriverConfig', column: 'tripPreferences', type: 'TEXT DEFAULT "[]"' },
  { table: 'DriverConfig', column: 'smokingAllowed', type: 'INTEGER DEFAULT 0' },
  { table: 'DriverConfig', column: 'petsAllowed', type: 'INTEGER DEFAULT 1' },
  { table: 'DriverConfig', column: 'musicAllowed', type: 'INTEGER DEFAULT 1' },
  { table: 'DriverConfig', column: 'prefersSilence', type: 'INTEGER DEFAULT 0' },
  { table: 'DriverConfig', column: 'hasAC', type: 'INTEGER DEFAULT 1' },
  { table: 'DriverConfig', column: 'driverGender', type: 'TEXT DEFAULT ""' },
  { table: 'DriverConfig', column: 'minDriverRating', type: 'REAL DEFAULT 0' },
  { table: 'DriverConfig', column: 'minPassengerRating', type: 'REAL DEFAULT 0' },
  // Communication preference for driver-passenger contact
  { table: 'DriverConfig', column: 'communicationPreference', type: 'TEXT DEFAULT "both"' },
  // Security features: selfie with DNI + third party photo
  { table: 'User', column: 'selfieWithDni', type: 'TEXT DEFAULT ""' },
  { table: 'Trip', column: 'thirdPartyPhoto', type: 'TEXT' },
];

// Full CREATE TABLE statements for new tables
const TABLE_CREATIONS = [
  `CREATE TABLE IF NOT EXISTS PendingChange (
    id TEXT PRIMARY KEY DEFAULT '',
    userId TEXT NOT NULL DEFAULT '',
    field TEXT NOT NULL DEFAULT '',
    oldValue TEXT DEFAULT '',
    newValue TEXT NOT NULL DEFAULT '',
    reason TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    reviewedBy TEXT,
    reviewedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
];

export async function GET() {
  const results: { column: string; status: string }[] = [];

  // First: create new tables
  for (const sql of TABLE_CREATIONS) {
    try {
      await prisma.$executeRawUnsafe(sql);
      results.push({ column: 'CREATE TABLE PendingChange', status: 'ok' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ column: 'CREATE TABLE PendingChange', status: msg.includes('already exists') ? 'skipped' : 'error: ' + msg });
    }
  }

  // Then: add columns
  for (const m of MIGRATIONS) {
    const sql = 'ALTER TABLE ' + m.table + ' ADD COLUMN ' + m.column + ' ' + m.type;
    try {
      await prisma.$executeRawUnsafe(sql);
      results.push({ column: m.table + '.' + m.column, status: 'ok' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('duplicate column') || msg.includes('already exists')) {
        results.push({ column: m.table + '.' + m.column, status: 'skipped' });
      } else {
        results.push({ column: m.table + '.' + m.column, status: 'error: ' + msg });
      }
    }
  }
  return NextResponse.json({ results });
}
