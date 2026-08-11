import { NextRequest, NextResponse } from 'next/server';

// Contact form submissions — stored in DB or sent via email
// For MVP: returns success and logs (in production, send email / create HelpTicket)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, subject, message } = body;

    // Validation
    if (!name || !message || !subject) {
      return NextResponse.json(
        { error: 'Nombre, asunto y mensaje son obligatorios' },
        { status: 400 }
      );
    }

    if (message.length < 10) {
      return NextResponse.json(
        { error: 'El mensaje debe tener al menos 10 caracteres' },
        { status: 400 }
      );
    }

    // Rate limiting check (simple: max 3 per hour per email)
    // In production, use Redis or DB-based rate limiting
    const contactSubmissions: Record<string, { count: number; firstAt: number }> =
      (global as any).__contactSubmissions || {};
    (global as any).__contactSubmissions = contactSubmissions;

    const key = email || phone || name;
    const now = Date.now();
    const record = contactSubmissions[key];

    if (record && record.count >= 3 && now - record.firstAt < 3600000) {
      return NextResponse.json(
        { error: 'Demasiados mensajes. Intenta de nuevo en una hora.' },
        { status: 429 }
      );
    }

    contactSubmissions[key] = {
      count: (record?.count || 0) + 1,
      firstAt: record?.firstAt || now,
    };

    // TODO: In production, send email to cooperativa@unira.app or create HelpTicket in DB
    console.log('[contact] New submission:', { name, email, phone, subject, messageLength: message.length });

    return NextResponse.json({
      success: true,
      message: 'Mensaje enviado correctamente. Te responderemos a la brevedad.',
    });
  } catch (err) {
    console.error('[contact] Error:', err);
    return NextResponse.json(
      { error: 'Error del servidor' },
      { status: 500 }
    );
  }
}
