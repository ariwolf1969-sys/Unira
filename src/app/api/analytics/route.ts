import { NextRequest, NextResponse } from 'next/server';

// Simple analytics endpoint — stores events in memory (Vercel serverless)
// In production, use a proper analytics service (PostHog, Mixpanel, Umami)

// In-memory store (resets on cold start — acceptable for MVP)
const events: Array<{
  event: string;
  userId?: string;
  screen?: string;
  metadata?: Record<string, string | number>;
  timestamp: string;
  userAgent: string;
}> = [];

const MAX_EVENTS = 10000;

export async function POST(req: NextRequest) {
  try {
    // Check cookie consent
    const consent = req.headers.get('x-cookie-consent');
    if (consent !== 'true') {
      return NextResponse.json({ tracked: false, reason: 'no_consent' });
    }

    const body = await req.json();
    const { event, userId, screen, metadata } = body;

    if (!event || typeof event !== 'string') {
      return NextResponse.json({ error: 'event is required' }, { status: 400 });
    }

    // Store event (trim if over limit)
    events.push({
      event,
      userId: userId || undefined,
      screen: screen || undefined,
      metadata: metadata || undefined,
      timestamp: new Date().toISOString(),
      userAgent: req.headers.get('user-agent') || '',
    });

    if (events.length > MAX_EVENTS) {
      events.splice(0, events.length - MAX_EVENTS);
    }

    return NextResponse.json({ tracked: true, totalEvents: events.length });
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
}

// Dashboard analytics summary (protected)
export async function GET(req: NextRequest) {
  const password = req.nextUrl.searchParams.get('password');
  if (password !== 'unira2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Aggregate events
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 3600000);
  const oneDayAgo = new Date(now.getTime() - 86400000);

  const recentHour = events.filter(e => new Date(e.timestamp) > oneHourAgo).length;
  const recentDay = events.filter(e => new Date(e.timestamp) > oneDayAgo).length;

  // Event breakdown
  const eventCounts: Record<string, number> = {};
  events.forEach(e => {
    eventCounts[e.event] = (eventCounts[e.event] || 0) + 1;
  });

  // Screen breakdown
  const screenCounts: Record<string, number> = {};
  events.forEach(e => {
    if (e.screen) screenCounts[e.screen] = (screenCounts[e.screen] || 0) + 1;
  });

  return NextResponse.json({
    total: events.length,
    lastHour: recentHour,
    lastDay: recentDay,
    topEvents: Object.entries(eventCounts).sort((a, b) => b[1] - a[1]).slice(0, 10),
    topScreens: Object.entries(screenCounts).sort((a, b) => b[1] - a[1]).slice(0, 10),
  });
}
