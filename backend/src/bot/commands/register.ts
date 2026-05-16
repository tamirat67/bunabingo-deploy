import { Context, Markup } from 'telegraf';
import { findOrCreateUser } from '../../services/user.service';
import { getOrCreateWallet } from '../../services/wallet.service';
import { logger } from '../../lib/logger';

/**
 * /register
 *
 * ┌─ New user (no phone) ──────────────────────────────────────────────────────┐
 * │  Sends a reply-keyboard with a contactRequest button.                      │
 * │  Tapping it triggers the native Telegram "Share your phone number?" dialog │
 * │  (the system popup shown in the screenshot).                               │
 * │  On share → bot/index.ts 'contact' handler saves the phone & shows /start. │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ Returning user (phone already saved) ─────────────────────────────────────┐
 * │  Shows their account profile card.                                         │
 * └────────────────────────────────────────────────────────────────────────────┘
 */
export async function handleRegister(ctx: Context) {
  const tgUser = ctx.from!;

  try {
    if (ctx.callbackQuery) await ctx.answerCbQuery();

    // Ensure DB record exists (creates wallet too if brand new)
    const user = await findOrCreateUser({
      id:         tgUser.id,
      username:   tgUser.username,
      first_name: tgUser.first_name,
      last_name:  tgUser.last_name,
    });

    await getOrCreateWallet(user.id);

    // ── First-time: phone not yet collected → trigger native contact dialog ──
    if (!user.phone && !user.phoneNumber) {
      logger.info(`[Register] New user ${tgUser.id} — requesting phone`);

      return ctx.reply(
        `👋 Welcome to <b>Buna Bingo</b>, ${tgUser.first_name}!\n\n` +
        `ምዝገባውን ለመጨረስ እባክዎ ስልክ ቁጥርዎን ያጋሩ።\n` +
        `(To complete your registration, we need your phone number.)\n\n` +
        `📱 ከታች ያለውን ቁልፍ በመጫን ስልክዎን ያጋሩ — ቴሌግራም ከማጋራቱ በፊት ማረጋገጫ ይጠይቅዎታል።\n` +
        `(Tap the button below — Telegram will ask for confirmation.)`,
        {
          parse_mode: 'HTML',
          ...Markup.keyboard([
            [Markup.button.contactRequest('📱 ስልክ ቁጥር ያጋሩ (Share Phone Number)')],
          ]).oneTime().resize(),
        }
      );
    }

    // ── Already registered → show profile card ────────────────────────────────
    const wallet = await getOrCreateWallet(user.id);

    const memberSince = user.createdAt.toLocaleDateString('en-ET', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    logger.info(`[Register] Returning user ${tgUser.id} — showing profile`);

    return ctx.reply(
      `✅ <b>Account Profile / የሂሳብ መረጃ</b>\n\n` +
      `👤 <b>ስም (Name):</b> ${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}\n` +
      `📱 <b>ስልክ (Phone):</b> ${user.phone || user.phoneNumber}\n` +
      `🆔 <b>Username:</b> ${user.telegramUsername ? `@${user.telegramUsername}` : 'N/A'}\n` +
      `📅 <b>የተመዘገቡበት (Member Since):</b> ${memberSince}\n` +
      `💰 <b>ሂሳብ (Balance):</b> ${Number(wallet.balance).toFixed(2)} ETB\n` +
      `👥 <b>ሪፈራል (Referrals):</b> ${user._count?.referrals || 0}`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('💰 ሂሳብ (Balance)',  'cmd_balance'),
            Markup.button.callback('💵 ብር ያስገቡ (Deposit)',  'cmd_deposit'),
          ],
          [
            Markup.button.callback('✏️ ስም ይቀይሩ (Change Name)', 'cmd_change_name'),
            Markup.button.callback('✉️ ጋብዝ (Invite)',       'cmd_invite'),
          ],
        ]),
      }
    );
  } catch (err: any) {
    logger.error('[Register] Error:', err);
    await ctx.reply('❌ Registration failed. Please try again or contact /support.');
  }
}
