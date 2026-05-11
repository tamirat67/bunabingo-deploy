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
          `🎉 <b>${referrerName}</b> invited you to <b>Buna Bingo</b>!\n` +
          `እንኳን ደና መጡ!\n\n` +
          `☕️ <i>"Spin Wheel, Play, Win: The Royal Buna Way."</i>\n` +
          `☕️ <i>"ይጎንጩ፣ ይጫወቱ፣ ያሸንፉ፦ በንጉሳዊው የቡና መንገድ!"</i>\n\n` +
          `✨ <b>Join now and you both earn a 5 ETB bonus!</b>\n` +
          `✨ <b>አሁኑኑ ይቀላቀሉ እና የ 5 ብር ቦነስ ያግኙ!</b>\n\n` +
          `To activate, please share your phone number:\n` +
          `ለመቀጠል እባክዎ ስልክ ቁጥርዎን ያጋሩ፡-`
        : // ── Organic / direct user path ──────────────────────────────────────
          `👋 Welcome to <b>Buna Bingo</b>, ${tgUser.first_name}!\n` +
          `እንኳን ደና መጡ!\n\n` +
          `☕️ <i>"Rich Flavor, Golden Wins."</i>\n` +
          `☕️ <i>"የቡና ጣዕም፣ ወርቃማ ድሎች።"</i>\n\n` +
          `Please share your phone number to continue:\n` +
          `ለመቀጠል እባክዎ ስልክ ቁጥርዎን ያጋሩ፡-`;

      const bannerUrl = `${process.env.WEBHOOK_URL}/uploads/banner.png`;

      return ctx.replyWithPhoto(bannerUrl, {
        caption: message,
        parse_mode: 'HTML',
        ...Markup.keyboard([
          [Markup.button.contactRequest('📱 Share Phone Number')],
        ]).oneTime().resize(),
      }).catch(() => {
        // Fallback if image fails to load
        return ctx.reply(message, {
          parse_mode: 'HTML',
          ...Markup.keyboard([
            [Markup.button.contactRequest('📱 Share Phone Number')],
          ]).oneTime().resize(),
        });
      });
    }

    // ── 3b. Phone already saved → show main menu ──────────────────────────────
    const inviteLink   = `${config.bot.miniAppUrl}/invite/${user.id}`;
    const shareMessage = encodeURIComponent(
      `🎰 Join me on Buna Bingo! ☕️ We both get 5 ETB bonus!\n\n`
    );
    const shareUrl = `https://t.me/share/url?url=${inviteLink}&text=${shareMessage}`;

    logger.info(`[Start] Showing main menu to ${tgUser.id} (${tgUser.first_name})`);

    const bannerUrl = `${process.env.WEBHOOK_URL}/uploads/banner.png`;
    
    // ── 4. Promotional Pinned Notice ──────────────────────────────────────────
    const promoText = 
      `☕️ <b>እንኳን ወደ ቡና ቢንጎ በሰላም መጡ!</b>\n\n` +
      `የቡና ጣዕም ከወርቃማ ድሎች ጋር የሚገናኝበት፣ የዕድል እና የቅንጦት ፍጹም ውህደት።\n` +
      `ይጎንጩ፣ ይጫወቱ፣ ያሸንፉ! በቡና ቢንጎ ሁሌም ከጃክፖት ጋር ይንቁ።\n\n` +
      `📌 <i>Tip: Pin this bot to your chat list for quick access!</i>`;

    try {
      const promoMsg = await ctx.replyWithPhoto(bannerUrl, {
        caption: promoText,
        parse_mode: 'HTML',
      });
      // Pin the message to the "header" of the bot page
      await ctx.telegram.pinChatMessage(ctx.chat!.id, promoMsg.message_id);
    } catch (e) {
      // Non-fatal if pinning fails
    }

    const mainMenuText = 
      `<b>Welcome to Buna Bingo!</b> ☕️💰\n` +
      `<b>እንኳን ደና መጡ!</b>\n\n` +
      `✨ "Rich Flavor, Golden Wins."\n` +
      `✨ "የቡና ጣዕም፣ ወርቃማ ድሎች።"\n\n` +
      `🎰 "The Perfect Blend of Luck and Luxury."\n` +
      `🎰 "የዕድል እና የቅንጦት ፍጹም ውህደት።"\n\n` +
      `👑 "Spin Wheel, Play, Win: The Royal Buna Way."\n` +
      `👑 "ይጎንጩ፣ ይጫወቱ፣ ያሸንፉ፦ በንጉሳዊው የቡና መንገድ!"\n\n` +
      `☀️🏆 "Buna Bingo — Wake Up to a Jackpot."\n` +
      `☀️🏆 "ቡና ቢንጎ — ከጃክፖት ጋር ይንቁ!"\n\n` +
      `Choose an option below:\n` +
      `ከታች አንድ አማራጭ ይምረጡ፡-\n\n` +
      `✉️ <a href="${shareUrl}">Share Invite Link & Earn 5 ETB!</a>`;

    await ctx.replyWithPhoto(bannerUrl, {
      caption: mainMenuText,
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
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
          Markup.button.callback('Instruction 📖', 'cmd_instructions'),
          Markup.button.url(
            'Invite ✉️',
            shareUrl
          ),
        ],
      ])
    }).catch(() => {
      // Fallback if image fails
      return ctx.reply(mainMenuText, 
        Markup.inlineKeyboard([
          [
            Markup.button.callback('Play Bingo 🎮', 'cmd_play_bingo'),
            Markup.button.callback('Play Spin 🎮',  'cmd_play_spin'),
          ],
          [
            Markup.button.callback('Register 📝',  'cmd_register'),
            Markup.button.callback('Deposit 💵',   'cmd_deposit'),
          ],
          [
            Markup.button.callback('Check Balance 💰', 'cmd_balance'),
            Markup.button.url('Contact support 📞', 'https://t.me/bunabingosupport'),
          ],
          [
            Markup.button.callback('Instruction 📖', 'cmd_instructions'),
            Markup.button.url(
              'Invite ✉️',
              shareUrl
            ),
          ],
        ])
      );
    });

    logger.info(`[Start] Main menu sent to ${user.id}`);
  } catch (err: any) {
    logger.error('[Start] FATAL ERROR in handleStart:', err);
    await ctx.reply('❌ Something went wrong. Please try again.');
  }
}
