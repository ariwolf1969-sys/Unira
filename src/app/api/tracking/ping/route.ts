import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * POST /api/tracking/ping
 *
 * Receives GPS pings from drivers and passengers to build a trace database.
 * Foundation of Phase 2: collecting real-world driving data for custom
 * routing, traffic estimation, and map improvements.
 *
 * Body: { userId, lat, lng, speed?, heading?, accuracy?, altitude?, tripId? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, lat, lng, speed, heading, accuracy, altitude, tripId } = body;

    if (!userId || lat == null || lng == null) {
      return NextResponse.json({ error: 'userId, lat, lng required' }, { status: 400 });
    }

    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (isNaN(latNum) || latNum < -90 || latNum > 90 ||
        isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }

    const dbUrl = process.env.DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!dbUrl || !authToken) {
      return NextResponse.json({ error: 'DB not configured' }, { status: 500 });
    }

    const { createClient } = await import('@libsql/client');
    const client = createClient({ url: dbUrl, authToken });

    const now = Date.now();

    // Build dynamic INSERT with only provided fields
    const cols = ['userId', 'lat', 'lng', 'createdAt'];
    const vals = [userId, latNum, lngNum, now];
    const placeholders = ['?', '?', '?', '?'];

    if (speed != null) { cols.push('speed'); vals.push(Number(speed)); placeholders.push('?'); }
    if (heading != null) { cols.push('heading'); vals.push(Number(heading)); placeholders.push('?'); }
    if (accuracy != null) { cols.push('accuracy'); vals.push(Number(accuracy)); placeholders.push('?'); }
    if (altitude != null) { cols.push('altitude'); vals.push(Number(altitude)); placeholders.push('?'); }
    if (tripId) { cols.push('tripId'); vals.push(String(tripId)); placeholders.push('?'); }

    const sql = `INSERT INTO LocationTrace (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`;

    try {
      await client.execute({ sql, args: vals });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('no such table')) {
        return NextResponse.json({ error: 'Run migration first: POST /api/admin/migrate' }, { status: 500 });
      }
      throw e;
    }

    return NextResponse.json({ ok: true, ts: now });
  } catch (error) {
    console.error('Tracking ping error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/**
 * GET /api/tracking/ping?userId=xxx&since=timestamp&limit=100
 * Retrieve GPS traces for a user (trip replay, debugging).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const since = searchParams.get('since');
    const limit = Math.min(Number(searchParams.get('limit') || 100), 1000);

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const dbUrl = process.env.DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!dbUrl || !authToken) {
      return NextResponse.json({ error: 'DB not configured' }, { status: 500 });
    }

    const { createClient } = await import('@libsql/client');
    const client = createClient({ url: dbUrl, authToken });

    let sql = 'SELECT * FROM LocationTrace WHERE userId = ?';
    const args: (string | number)[] = [userId];

    if (since) { sql += ' AND createdAt > ?'; args.push(Number(since)); }
    sql += ' ORDER BY createdAt DESC LIMIT ?';
    args.push(limit);

    try {
      const result = await client.execute({ sql, args });
      return NextResponse.json({ traces: result.rows });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('no such table')) {
        return NextResponse.json({ error: 'Table not found', traces: [] });
      }
      throw e;
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
