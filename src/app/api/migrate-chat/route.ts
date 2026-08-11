import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// One-time migration: create TripMessage table via Prisma
// Call GET /api/migrate-chat to create the table in Turso
export async function GET() {
  try {
    // Execute raw SQL to create TripMessage table if not exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS TripMessage (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)) || hex(randomblob(4)) || '4' || substr(hex(randomblob(3)),1,3) || hex(randomblob(1)) || hex(randomblob(6)) || hex(randomblob(6)))),
        tripId TEXT NOT NULL,
        fromUserId TEXT NOT NULL,
        toUserId TEXT NOT NULL,
        text TEXT NOT NULL,
        read INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (tripId) REFERENCES Trip(id)
      )
    `);

    // Create index for faster queries
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_tripmessage_tripid ON TripMessage(tripId)
    `);

    return NextResponse.json({ success: true, message: 'TripMessage table created' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Migration error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
