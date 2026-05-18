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
        `👋 ወደ <b>ቡና ቢንጎ</b> እንኳን ደህና መጡ፣ ${tgUser.first_name}!\n\n` +
        `ምዝገባውን ለመጨረስ እባክዎ ስልክ ቁጥርዎን ያጋሩ።\n\n` +
        `📱 ከታች ያለውን ቁልፍ በመጫን ስልክዎን ያጋሩ — ቴሌግራም ከማጋራቱ በፊት ማረጋገጫ ይጠይቅዎታል።`,
        {
          parse_mode: 'HTML',
          ...Markup.keyboard([
            [Markup.button.contactRequest('📱 ስልክ ቁጥር ያጋሩ')],
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
      `✅ <b>የሂሳብ መረጃ</b>\n\n` +
      `👤 <b>ስም፦</b> ${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}\n` +
      `📱 <b>ስልክ፦</b> ${user.phone || user.phoneNumber}\n` +
      `🆔 <b>የተጠቃሚ ስም (Username)፦</b> ${user.telegramUsername ? `@${user.telegramUsername}` : 'የለም'}\n` +
      `📅 <b>የተመዘገቡበት ቀን፦</b> ${memberSince}\n` +
      `💰 <b>ሂሳብ፦</b> ${Number(wallet.balance).toFixed(2)} ብር (ETB)\n` +
      `👥 <b>የተጋበዙ ሰዎች (Referrals)፦</b> ${user._count?.referrals || 0}`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('💰 ሂሳብ',  'cmd_balance'),
            Markup.button.callback('💵 ብር ያስገቡ',  'cmd_deposit'),
          ],
          [
            Markup.button.callback('✏️ ስም ይቀይሩ', 'cmd_change_name'),
            Markup.button.callback('✉️ ጓደኛ ይጋብዙ',       'cmd_invite'),
          ],
        ]),
      }
    );
  } catch (err: any) {
    logger.error('[Register] Error:', err);
    if (err.message && err.message.includes('REGISTRATION_BLOCKED_NO_AGENT')) {
      const userMsg = err.message.split('REGISTRATION_BLOCKED_NO_AGENT:')[1].trim();
      await ctx.reply(userMsg);
    } else {
      await ctx.reply('❌ ምዝገባው አልተሳካም። እባክዎ እንደገና ይሞክሩ ወይም /support ያግኙ።');
    }
  }
}
