import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isEmailTokenValid } from '@/lib/verification';

export const runtime = 'nodejs';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';

/**
 * Email verification handler.
 * - Browser navigation (GET with Accept: text/html): redirects to app URL with ?email-status=...
 * - In-app fetch (Accept: application/json or XHR): returns JSON so the SPA can update state inline.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  const isApiRequest = request.headers.get('accept')?.includes('application/json') ||
    request.headers.get('x-requested-with') === 'XMLHttpRequest';

  if (!token) {
    if (isApiRequest) {
      return NextResponse.json({ error: 'Falta el token de verificación.' }, { status: 400 });
    }
    return NextResponse.redirect(`${APP_URL}/?email-error=missing-token`);
  }

  try {
    const user = await prisma.user.findFirst({
      where: { emailVerifyToken: token },
      select: {
        id: true,
        email: true,
        emailVerifyExpiresAt: true,
        emailVerifiedAt: true,
      },
    });

    if (!user) {
      if (isApiRequest) {
        return NextResponse.json({ error: 'Token de verificación inválido.' }, { status: 404 });
      }
      return NextResponse.redirect(`${APP_URL}/?email-error=invalid-token`);
    }

    if (user.emailVerifiedAt) {
      if (isApiRequest) {
        return NextResponse.json({ success: true, message: 'El email ya estaba verificado.' });
      }
      return NextResponse.redirect(`${APP_URL}/?email-status=already-verified`);
    }

    if (!isEmailTokenValid(user.emailVerifyExpiresAt)) {
      if (isApiRequest) {
        return NextResponse.json({ error: 'El enlace expiró. Solicitá uno nuevo desde la app.' }, { status: 400 });
      }
      return NextResponse.redirect(`${APP_URL}/?email-error=expired`);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerifyToken: null,
        emailVerifyExpiresAt: null,
      },
    });

    if (isApiRequest) {
      return NextResponse.json({ success: true, message: 'Email verificado correctamente.' });
    }

    // Browser navigation — show a friendly HTML page instead of redirecting
    // (redirecting to SPA root loses localStorage state, causing "restart registration")
    return new NextResponse(
      `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Email verificado - TEYEVO</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #F5F7FA; color: #1a1a1a; }
    .card { max-width: 400px; text-align: center; padding: 40px 24px; }
    .icon { width: 64px; height: 64px; border-radius: 50%; background: #d1fae5; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 32px; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    p { font-size: 15px; color: #6b7280; line-height: 1.6; margin: 0; }
    .btn { display: inline-block; margin-top: 24px; padding: 14px 32px; background: linear-gradient(135deg, #0EA5A0, #0C8CE9); color: white; text-decoration: none; font-weight: 600; border-radius: 12px; font-size: 15px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h1>¡Email verificado!</h1>
    <p>Tu correo electrónico fue verificado correctamente. Ya podés volver a la app de TEYEVO.</p>
    <a href="${APP_URL}" class="btn">Volver a TEYEVO</a>
  </div>
</body>
</html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (error) {
    console.error('Verify email error:', error);
    if (isApiRequest) {
      return NextResponse.json({ error: 'Error del servidor.' }, { status: 500 });
    }
    return NextResponse.redirect(`${APP_URL}/?email-error=server`);
  }
}
