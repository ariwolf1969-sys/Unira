import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * Telegram Bot webhook.
 *
 * Receives updates from Telegram (messages, /start commands, etc.) and
 * links the user's chat_id to their TEYEVO account by phone number.
 *
 * Setup:
 *   1. Create a bot with @BotFather → get TELEGRAM_BOT_TOKEN.
 *   2. Set this endpoint as the webhook:
 *      curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<APP_URL>/api/telegram/webhook"
 *   3. When a user opens the bot via the deep link `https://t.me/<BOT>?start=<PHONE>`,
 *      Telegram sends us an update with message.text = "/start <PHONE>" and
 *      message.chat.id = the user's chat_id. We store it on the User row.
 */

interface TelegramUpdate {
  message?: {
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    from?: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
  };
}

export async function POST(request: NextRequest) {
  // Reject if bot token isn't configured — webhook shouldn't be active anyway
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ ok: false, error: 'Bot token not configured' }, { status: 503 });
  }

  try {
    const update = (await request.json()) as TelegramUpdate;
    const msg = update.message;
    if (!msg || !msg.text) {
      return NextResponse.json({ ok: true });  // ignore non-message updates
    }

    // Only handle /start commands
    if (!msg.text.startsWith('/start')) {
      return NextResponse.json({ ok: true });
    }

    // Parse phone from /start <phone>
    // Telegram strips the leading slash from deep-link payloads, so the text
    // arrives as "/start +5491155555555" or "/start 5491155555555".
    const parts = msg.text.split(/\s+/);
    const phoneArg = parts[1]?.trim();

    if (!phoneArg) {
      // User opened the bot without a deep link — send a welcome explaining usage
      await sendTelegramMessage(
        msg.chat.id,
        '👋 ¡Hola! Soy el bot de TEYEVO.\n\n' +
          'Para recibir tus códigos de verificación por Telegram, abrí la app TEYEVO y tocá "Recibir código por Telegram". ' +
          'Te vamos a abrir este chat automáticamente con tu número ya cargado, y a partir de ahí los códigos llegarán acá.'
      );
      return NextResponse.json({ ok: true });
    }

    // Normalize phone: accept with or without + prefix
    let phone = phoneArg;
    if (!phone.startsWith('+')) phone = '+' + phone;

    // Find the user by phone
    const user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, name: true, phone: true, telegramChatId: true },
    });

    if (!user) {
      await sendTelegramMessage(
        msg.chat.id,
        '❌ No encontramos una cuenta TEYEVO con ese número de teléfono.\n\n' +
          `Verificá que el número (${phone}) sea el mismo que usaste para registrarte en la app y volvé a intentarlo.`
      );
      return NextResponse.json({ ok: true });
    }

    // Already linked? Send a friendly "you're all set" message
    if (user.telegramChatId === String(msg.chat.id)) {
      await sendTelegramMessage(
        msg.chat.id,
        `✅ ¡Listo, ${user.name}! Tu cuenta TEYEVO ya está vinculada a Telegram.\n\n` +
          'A partir de ahora, tus códigos de verificación llegarán a este chat (más rápido y gratis que por SMS).'
      );
      return NextResponse.json({ ok: true });
    }

    // Link chat_id to user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        telegramChatId: String(msg.chat.id),
        otpChannel: 'telegram',  // switch default channel to Telegram now that it's linked
      },
    });

    await sendTelegramMessage(
      msg.chat.id,
      `✅ ¡Listo, ${user.name}! Vinculaste tu cuenta TEYEVO a Telegram.\n\n` +
        'A partir de ahora, tus códigos de verificación llegarán a este chat.\n\n' +
        'Si en algún momento querés volver a recibirlos por SMS, podés cambiarlo desde la app en "Cuenta → Verificación".'
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}

async function sendTelegramMessage(chatId: number, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
  } catch (e) {
    console.warn('Telegram sendMessage failed:', e);
  }
}
