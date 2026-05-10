import { Context, Markup } from 'telegraf';
import { findOrCreateUser, getUserById } from '../../services/user.service';
import { getOrCreateWallet } from '../../services/wallet.service';
import { config } from '../../config';
import { logger } from '../../lib/logger';

export async function handleStart(ctx: Context) {
  const tgUser     = ctx.from!;
  const startPayload = (ctx as any).startPayload as string | undefined; // referrer user.id from deep link

  try {
    // ── 1. Resolve referrer (if any) before creating the user record ───────────
    let referrerName: string | null = null;
    let validReferrerId: string | undefined;

    if (startPayload && startPayload.length > 20) {
      // UUIDs are 36 chars — quick sanity check
      try {
        const referrer = await getUserById(startPayload);
        if (referrer && Number(referrer.telegramId) !== tgUser.id) {
          referrerName   = referrer.firstName;
          validReferrerId = referrer.id;
        }
      } catch {
        // Non-critical — if referrer lookup fails, just proceed without attribution
      }
    }

    // ── 2. Upsert user record ─────────────────────────────────────────────────
    const user = await findOrCreateUser(
      {
        id:         tgUser.id,
        username:   tgUser.username,
        first_name: tgUser.first_name,
        last_name:  tgUser.last_name,
      },
      validReferrerId
    );

    await getOrCreateWallet(user.id);

    // ── 3a. Phone not yet collected → smart contextual contact-share prompt ────
    if (!user.phoneNumber) {
      logger.info(`[Start] User ${tgUser.id} needs phone. Referred by: ${referrerName ?? 'none'}`);

      // Build message depending on whether they came via invite link
      const message = referrerName
        ? // ── Invited user path ───────────────────────────────────────────────
          `🎉 <b>${referrerName}</b> invited you to <b>Buna Bingo</b>!\n\n` +
          `☕️ <i>The ultimate Ethiopian bingo experience.</i>\n\n` +
          `✨ <b>Join now and you both earn a 2 ETB bonus!</b>\n\n` +
          `To activate your account, please share your phone number.\n` +
          `Telegram will ask for your confirmation before sharing anything.`
        : // ── Organic / direct user path ──────────────────────────────────────
          `👋 Welcome to <b>Buna Bingo</b>, ${tgUser.first_name}!\n\n` +
          `☕️ <i>Rich Flavor, Golden Wins.</i>\n\n` +
          `To keep your account secure and prevent duplicates, ` +
          `please share your phone number to continue.\n` +
          `Telegram will ask for your confirmation before sharing anything.`;

      return ctx.reply(message, {
        parse_mode: 'HTML',
        // contactRequest triggers the native "Share your phone number?" system dialog
        ...Markup.keyboard([
          [Markup.button.contactRequest('📱 Share Phone Number')],
        ]).oneTime().resize(),
      });
    }

    // ── 3b. Phone already saved → show main menu ──────────────────────────────
    const inviteLink = `https://t.me/${ctx.botInfo.username}?start=${user.id}`;
    const shareText  = encodeURIComponent(
      `🎰 Join me on Buna Bingo! ☕️ We both get 2 ETB bonus!\n\n${inviteLink}`
    );

    logger.info(`[Start] Showing main menu to ${tgUser.id} (${tgUser.first_name})`);

    await ctx.reply(
      `Welcome to Buna Bingo! Choose an option below.`,
      Markup.inlineKeyboard([
        // ── Row 1: Games ─────────────────────────────────────────────────────
        [
          Markup.button.callback('Play Bingo 🎮', 'cmd_play_bingo'),
          Markup.button.callback('Play Spin 🎮',  'cmd_play_spin'),
        ],
        // ── Row 2: Account ───────────────────────────────────────────────────
        [
          Markup.button.callback('Register 📝',  'cmd_register'),
          Markup.button.callback('Deposit 💵',   'cmd_deposit'),
        ],
        // ── Row 3: Wallet & Support ──────────────────────────────────────────
        [
          Markup.button.callback('Check Balance 💰', 'cmd_balance'),
          Markup.button.url('Contact support 📞', 'https://t.me/bunabingosupport'),
        ],
        // ── Row 4: Help & Referral ────────────────────────────────────────────
        [
          Markup.button.webApp('Instruction 📖', `${config.bot.miniAppUrl}/instructions`),
          Markup.button.url(
            'Invite ✉️',
            `https://t.me/share/url?url=${inviteLink}&text=${shareText}`
          ),
        ],
      ])
    );

    logger.info(`[Start] Main menu sent to ${user.id}`);
  } catch (err: any) {
    logger.error('[Start] FATAL ERROR in handleStart:', err);
    await ctx.reply('❌ Something went wrong. Please try again.');
  }
}
