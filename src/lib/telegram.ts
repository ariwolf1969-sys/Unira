/**
 * Telegram Bot OTP sender.
 *
 * Sends the OTP code to the user via Telegram using the Bot API.
 * The user must have previously started a chat with the bot (/start) so we
 * have their chat_id — we store it in the User table as `telegramChatId`.
 *
 * To enable:
 *   1. Create a bot with @BotFather → get the bot token.
 *   2. Set TELEGRAM_BOT_TOKEN env var.
 *   3. Set TELEGRAM_BOT_USERNAME so we can build a deep link for users who
 *      haven't started the bot yet (e.g. @TEYEVO_bot).
 *   4. Use the /api/telegram/webhook endpoint (or long polling) to capture
 *      chat_id when a user messages the bot for the first time.
 *
 * If the bot token isn't configured, this module returns `devMode: true`
 * and surfaces the OTP to the caller (same as the SMS dev path).
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'TEYEVO_bot';

export interface TelegramOtpResult {
  success: boolean;
  devMode: boolean;
  devCode?: string;
  needsLink?: boolean;      // true when the user hasn't started the bot yet
  botLink?: string;          // deep link the user can tap to open the bot
  error?: string;
}

/**
 * Send an OTP message to a Telegram chat.
 * `chatId` should be the numeric Telegram chat_id we stored when the user
 * first messaged the bot.
 */
export async function sendOtpTelegram(
  chatId: string | null | undefined,
  phone: string,
  code: string
): Promise<TelegramOtpResult> {
  // Dev mode: no bot token
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✈️  [DEV MODE] Telegram OTP (no TELEGRAM_BOT_TOKEN configured)');
    console.log(`   To: ${phone} (chatId: ${chatId || '—'})`);
    console.log(`   Code: ${code}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return { success: true, devMode: true, devCode: code };
  }

  // No chat_id stored → user needs to open the bot first
  if (!chatId) {
    const botLink = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${encodeURIComponent(phone)}`;
    return {
      success: false,
      devMode: false,
      needsLink: true,
      botLink,
      error: 'Necesitás iniciar el bot de Telegram primero para recibir el código.',
    };
  }

  try {
    const text =
      `🔒 *Tu código de verificación TEYEVO* es:\n\n` +
      `\`${code}\`\n\n` +
      `No lo compartas con nadie. Si no pediste este código, ignorá este mensaje.`;

    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error('Telegram API error:', res.status, errText);
      // Common case: chat_id no longer valid (user blocked the bot).
      // Surface a friendly error so the UI can prompt them to re-link.
      const friendly =
        res.status === 403
          ? 'El usuario bloqueó al bot o cerró el chat. Volvé a iniciar la conversación.'
          : `Telegram API error: ${res.status}`;
      return { success: false, devMode: false, error: friendly };
    }

    return { success: true, devMode: false };
  } catch (e) {
    console.error('sendOtpTelegram error:', e);
    return { success: false, devMode: false, error: 'No se pudo enviar el código por Telegram.' };
  }
}

/**
 * Verify the Telegram bot token by calling /getMe. Useful for the admin panel.
 * Returns the bot's username if valid, null otherwise.
 */
export async function verifyTelegramBot(): Promise<string | null> {
  if (!TELEGRAM_BOT_TOKEN) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.result?.username ?? null;
  } catch {
    return null;
  }
}
