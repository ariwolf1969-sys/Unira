import { NextResponse } from 'next/server';
import { verifyTelegramBot } from '@/lib/telegram';

export const runtime = 'nodejs';

/**
 * GET /api/telegram/status
 * Returns whether the Telegram bot is configured and what its username is.
 * Used by the verification screen to build the deep link to open the bot.
 */
export async function GET() {
  const botUsername = await verifyTelegramBot();
  if (!botUsername) {
    return NextResponse.json({
      configured: false,
      botUsername: process.env.TELEGRAM_BOT_USERNAME || null,
    });
  }
  return NextResponse.json({
    configured: true,
    botUsername,
    deepLinkBase: `https://t.me/${botUsername}?start=`,
  });
}
