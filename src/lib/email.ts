/**
 * Email sending utility.
 *
 * Production: uses Resend (https://resend.com) when RESEND_API_KEY is set.
 * Dev/prototype: logs the email content to server console and returns
 *                the verification URL so the dev can click it.
 *
 * To enable real email in production:
 *   1. Sign up at https://resend.com (free tier: 100 emails/day)
 *   2. Get your API key
 *   3. Add `RESEND_API_KEY` to your Vercel env vars
 *   4. (Optional) Verify your domain to send from your own address
 *      Otherwise we fall back to Resend's shared `onboarding@resend.dev`.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'TEYEVO <onboarding@resend.dev>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';

export interface SendEmailResult {
  success: boolean;
  devMode: boolean;
  devLink?: string;   // present when running in dev mode (no API key)
  error?: string;
}

export async function sendVerificationEmail(
  toEmail: string,
  userName: string,
  token: string
): Promise<SendEmailResult> {
  const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${token}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 56px; height: 56px; border-radius: 16px; background: linear-gradient(135deg, #0EA5A0, #0C8CE9); margin-bottom: 16px;"></div>
        <h1 style="color: #0A0F14; font-size: 22px; margin: 0;">Verificá tu email</h1>
      </div>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6;">
        Hola <strong>${userName}</strong>,
      </p>
      <p style="color: #4B5563; font-size: 15px; line-height: 1.6;">
        Estás a un paso de completar tu registro en TEYEVO. Tocá el botón de abajo para verificar tu correo electrónico:
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${verifyUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #0EA5A0, #0C8CE9); color: white; text-decoration: none; font-weight: 600; border-radius: 12px; font-size: 15px;">
          Verificar mi email
        </a>
      </div>
      <p style="color: #6B7280; font-size: 13px; line-height: 1.5;">
        Si no creaste una cuenta en TEYEVO, podés ignorar este correo. El enlace expira en 24 horas.
      </p>
      <p style="color: #9CA3AF; font-size: 12px; margin-top: 32px; text-align: center;">
        TEYEVO · Cooperativa UNIRA · Argentina
      </p>
    </div>
  `;

  // Dev mode: no API key configured
  if (!RESEND_API_KEY) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 [DEV MODE] Email verification (no RESEND_API_KEY configured)');
    console.log(`   To: ${toEmail}`);
    console.log(`   User: ${userName}`);
    console.log(`   Verify URL: ${verifyUrl}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return { success: true, devMode: true, devLink: verifyUrl };
  }

  // Production: send via Resend HTTP API
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: toEmail,
        subject: 'Verificá tu email en TEYEVO',
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Resend API error:', res.status, errText);
      // Common Resend errors:
      //   422: validation (invalid email format, sender not verified)
      //   403: domain not verified (when using a custom FROM_EMAIL)
      //   429: rate limit
      let friendly = `No se pudo enviar el email (código ${res.status}).`;
      try {
        const errJson = JSON.parse(errText);
        if (res.status === 422) {
          friendly = 'La dirección de email no es válida. Revisá el correo que ingresaste.';
        } else if (res.status === 403) {
          friendly = 'El dominio de envío no está verificado. Contactá a soporte@teyevo.app.';
        } else if (res.status === 429) {
          friendly = 'Demasiados emails enviados. Esperá unos minutos y reintentá.';
        } else if (errJson?.message) {
          friendly = `Email: ${errJson.message}`;
        }
      } catch { /* ignore parse error */ }
      return { success: false, devMode: false, error: friendly };
    }

    return { success: true, devMode: false };
  } catch (e) {
    console.error('sendVerificationEmail error:', e);
    return { success: false, devMode: false, error: 'No se pudo conectar con el proveedor de email.' };
  }
}
