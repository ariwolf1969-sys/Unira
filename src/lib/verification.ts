/**
 * Verification utilities: OTP generation, token generation, expiry helpers,
 * and multi-channel OTP delivery (Telegram preferred, SMS fallback).
 *
 * OTP: 6-digit numeric code, expires in 5 minutes.
 * Email token: 32-char hex, expires in 24 hours.
 *
 * Canal preference order (when delivering OTP):
 *   1. Telegram  (gratis, preferido por el usuario) — requiere TELEGRAM_BOT_TOKEN
 *      y que el usuario haya iniciado el bot (chat_id stored in User.telegramChatId).
 *   2. SMS       (Twilio, pago) — requiere TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN
 *      + TWILIO_PHONE_NUMBER.
 *   3. Dev mode  (no provider configured) — returns the OTP in the response
 *      so the UI can display it in a banner. Use this in dev only.
 *
 * The user's preferred channel can be set on the User record (`otpChannel`).
 * If unset or unavailable, we fall back through the chain automatically.
 */

import crypto from 'crypto';
import { sendOtpTelegram, type TelegramOtpResult } from './telegram';

const OTP_TTL_MS = 5 * 60 * 1000;        // 5 minutes
const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;  // 24 hours

export function generateOtp(): string {
  // 6-digit zero-padded code
  return String(crypto.randomInt(0, 999999)).padStart(6, '0');
}

export function generateEmailToken(): string {
  return crypto.randomBytes(16).toString('hex');  // 32 chars
}

export function otpExpiry(): Date {
  return new Date(Date.now() + OTP_TTL_MS);
}

export function emailTokenExpiry(): Date {
  return new Date(Date.now() + EMAIL_TOKEN_TTL_MS);
}

export function isOtpValid(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() > Date.now();
}

export function isEmailTokenValid(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() > Date.now();
}

/**
 * Unified OTP delivery result. `channel` tells the caller which path was
 * taken so the UI can show the right hint ("Te lo enviamos por Telegram"
 * vs "SMS no configurado, tu código es 123456").
 */
export interface OtpDeliveryResult {
  success: boolean;
  channel: 'telegram' | 'sms' | 'dev';
  devMode: boolean;
  devCode?: string;
  needsTelegramLink?: boolean;
  telegramBotLink?: string;
  error?: string;
}

export type OtpChannel = 'telegram' | 'sms' | 'whatsapp';

export interface OtpUserContext {
  phone: string;
  /** Telegram chat_id, if the user already started the bot. */
  telegramChatId?: string | null;
  /** User's preferred channel. Defaults to 'telegram'. */
  preferredChannel?: OtpChannel | null;
}

/**
 * Send an OTP using whichever channel is available, in priority order:
 *   Telegram → SMS → Dev.
 *
 * If the user explicitly preferred SMS and Twilio is configured, we skip
 * Telegram even if a chat_id is present.
 */
export async function deliverOtp(
  user: OtpUserContext,
  code: string
): Promise<OtpDeliveryResult> {
  const preferred = (user.preferredChannel ?? 'telegram') as OtpChannel;

  // ── Telegram path ──
  if (preferred === 'telegram') {
    const tg: TelegramOtpResult = await sendOtpTelegram(
      user.telegramChatId,
      user.phone,
      code
    );
    if (tg.success) {
      return {
        success: true,
        channel: tg.devMode ? 'dev' : 'telegram',
        devMode: tg.devMode,
        devCode: tg.devCode,
      };
    }
    // If Telegram returned needsLink (user hasn't started the bot), surface
    // that to the UI — but ALSO try SMS as a graceful fallback so the user
    // can still verify now and link Telegram later.
    if (tg.needsLink) {
      const smsFallback = await sendOtpSmsRaw(user.phone, code);
      if (smsFallback.success) {
        return {
          success: true,
          channel: smsFallback.devMode ? 'dev' : 'sms',
          devMode: smsFallback.devMode,
          devCode: smsFallback.devCode,
          needsTelegramLink: true,
          telegramBotLink: tg.botLink,
        };
      }
    }
    // Other Telegram errors (bot blocked, etc.) — fall through to SMS
  }

  // ── SMS path (explicit preference or Telegram fallback) ──
  const sms = await sendOtpSmsRaw(user.phone, code);
  if (sms.success) {
    return {
      success: true,
      channel: sms.devMode ? 'dev' : 'sms',
      devMode: sms.devMode,
      devCode: sms.devCode,
    };
  }

  // All real channels failed — return error so the UI can show it
  return {
    success: false,
    channel: 'sms',
    devMode: false,
    error: sms.error || 'No se pudo enviar el código. Reintentá en unos minutos.',
  };
}

/**
 * SMS sending via Twilio. Exported for direct use, but prefer `deliverOtp`.
 *
 * Production: integrate Twilio.
 * Dev: returns the OTP so the caller can display it on screen.
 *
 * To enable real SMS:
 *   1. Sign up at https://twilio.com
 *   2. Get Account SID, Auth Token, and a phone number
 *   3. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER to env
 */
export interface SmsResult {
  success: boolean;
  devMode: boolean;
  devCode?: string;  // present when running in dev mode
  error?: string;
}

/** @deprecated Use deliverOtp() — kept for backward compat. */
export async function sendOtpSms(phone: string, code: string): Promise<SmsResult> {
  return sendOtpSmsRaw(phone, code);
}

async function sendOtpSmsRaw(phone: string, code: string): Promise<SmsResult> {
  const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;

  // Dev mode
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 [DEV MODE] SMS OTP (no Twilio configured)');
    console.log(`   To: ${phone}`);
    console.log(`   Code: ${code}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return { success: true, devMode: true, devCode: code };
  }

  // Production: Twilio API
  try {
    const body = new URLSearchParams({
      To: phone,
      From: TWILIO_FROM,
      Body: `Tu código de verificación TEYEVO es: ${code}. No lo compartas con nadie.`,
    });

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Twilio API error:', res.status, errText);
      // Common Twilio errors:
      //   21211: invalid phone number
      //   21614: landline can't receive SMS
      //   20429: rate limit
      let friendly = `No se pudo enviar el SMS (código ${res.status}).`;
      try {
        const errJson = JSON.parse(errText);
        if (errJson.code === 21211) friendly = 'El número de teléfono no es válido.';
        else if (errJson.code === 21614) friendly = 'Este número no puede recibir SMS (¿es línea fija?).';
        else if (errJson.code === 20429) friendly = 'Demasiados SMS enviados. Esperá unos minutos y reintentá.';
      } catch { /* ignore parse error */ }
      return { success: false, devMode: false, error: friendly };
    }

    return { success: true, devMode: false };
  } catch (e) {
    console.error('sendOtpSms error:', e);
    return { success: false, devMode: false, error: 'No se pudo conectar con el proveedor de SMS.' };
  }
}

