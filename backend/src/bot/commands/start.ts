import { Context, Markup } from 'telegraf';
import { findOrCreateUser, getUserById } from '../../services/user.service';
import { getOrCreateWallet } from '../../services/wallet.service';
import { config } from '../../config';
import { logger } from '../../lib/logger';
import { getJackpot } from '../../services/jackpot.service';

export async function handleStart(ctx: Context) {
  const tgUser     = ctx.from!;
  const startPayload = (ctx as any).startPayload as string | undefined; // referrer user.id from deep link

  try {
    // ── 1. Resolve referrer (if any) before creating the user record ───────────
    let referrerName: string | null = null;
    let validReferrerId: string | undefined;

    if (startPayload === 'deposit') {
      const { handleDeposit } = await import('./deposit');
      return handleDeposit(ctx);
    }

    if (startPayload === 'withdraw') {
      const { handleWithdraw } = await import('./withdraw');
      return handleWithdraw(ctx);
    }

  if (startPayload && startPayload.length > 20) {
      // UUIDs are 36 chars — quick sanity check
      try {
        const referrer = await getUserById(startPayload);
        if (referrer && Number(referrer.telegramId) !== tgUser.id) {
          referrerName   = (referrer as any).firstName;
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
    if (!(user as any).phone) {
      logger.info(`[Start] User ${tgUser.id} needs phone. Referred by: ${referrerName ?? 'none'}`);

      // Build message depending on whether they came via invite link
      const message = referrerName
        ? // ── Invited user path ───────────────────────────────────────────────
          `🎉 <b>${referrerName}</b> invited you to <b>Buna Bingo</b>!\n` +
          `እንኳን ደና መጡ!\n\n` +
          `☕️ <i>"Buna Bingo, Play, Win: The Royal Buna Way."</i>\n` +
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
    const botUsername2 = ctx.botInfo?.username ?? 'buna_bingobot';
    const inviteLink   = `https://t.me/${botUsername2}?start=${user.id}`;
    const shareMessage = encodeURIComponent(
      `🎰 Join me on Buna Bingo! ☕️ We both get 5 ETB bonus!\n\n`
    );
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${shareMessage}`;

    logger.info(`[Start] Showing main menu to ${tgUser.id} (${tgUser.first_name})`);

    const jackpot = await getJackpot();
    const jackpotAmount = Number(jackpot.currentAmount).toFixed(2);
    const targetAmount = Number(jackpot.targetAmount).toFixed(2);

    // ── 4. Jackpot Splash Notice ─────────────────────────────────────────────
    const jackpotSplashText = 
      `🏆 <b>የደራሽ ጃክፖት (Derash Jackpot)</b> 🏆\n\n` +
      `🎉 <b>ታላቅ ዜና!</b>\n` +
      `የጃክፖት ሽልማት አሁን ተጀምሯል! 💰\n\n` +
      `🔥 <b>CURRENT JACKPOT: ${jackpotAmount} ETB</b> 🔥\n` +
      `🎯 <b>TARGET: ${targetAmount} ETB</b>\n\n` +
      `በመጫወት የጃክፖት ሽልማት አሸናፊ ይሁኑ! መልካም እድል! 🍀\n\n` +
      `👉👉 <b>የደራሽ ጃክፖት አሰራር!</b>\n\n` +
      `💰 1️⃣ በእያንዳንዱ ጨዋታ የሚሰበሰበው መደብ ከ100 ሲበልጥ ከደራሹ ላይ የተወሰነ ፐርሰንት ወደ ጃክፖቱ ይተላለፋል።\n` +
      `📈 2️⃣ ጃክፖቱ የታለመለትን መጠን (Target Amount) እስኪሞላ ድረስ መጠኑ ይጨምራል። 💥\n` +
      `🎯 3️⃣ ልክ ታርጌቱ ሲሞላ፣ ጃክፖቱ ይፈነዳል!\n` +
      `🔓 4️⃣ በዛ ሰዓት ያሸነፈው እድለኛ ተጫዋች ጠቅላላውን ጃክፖት + መደበኛውን ሽልማት ይወስዳል! 🏆\n\n` +
      `🏆 እድሉን ይሞክሩ! መልካም እድል! 🍀\n\n` +
      `📌 <i>Tip: Pin this bot to your chat list for quick access!</i>`;

    const jackpotSplashUrl = `${process.env.WEBHOOK_URL}/uploads/jackpot_splash.png`;

    try {
      const splashMsg = await ctx.replyWithPhoto(jackpotSplashUrl, {
        caption: jackpotSplashText,
        parse_mode: 'HTML',
      }).catch(() => {
        // Fallback to text if image fails
        return ctx.reply(jackpotSplashText, { parse_mode: 'HTML' });
      });
      
      // Pin the jackpot notice
      if (splashMsg && 'message_id' in splashMsg) {
        await ctx.telegram.pinChatMessage(ctx.chat!.id, splashMsg.message_id);
      }
    } catch (e) {
      // Non-fatal
    }

    const bannerUrl = `${process.env.WEBHOOK_URL}/uploads/banner.png`;
    const mainMenuText = 
      `<b>Welcome to Buna Bingo!</b> ☕️💰\n` +
      `<b>እንኳን ደና መጡ!</b>\n\n` +
      `🔥 <b>CURRENT JACKPOT: ${jackpotAmount} ETB</b> 🔥\n` +
      `🔥 <b>ያሁኑ ጃክፖት፡ ${jackpotAmount} ብር</b> 🔥\n\n` +
      `✨ "Rich Flavor, Golden Wins."\n` +
      `☕️ "የቡና ጣዕም፣ ወርቃማ ድሎች።"\n\n` +
      `🎰 "The Perfect Blend of Luck and Luxury."\n` +
      `☕️ "የዕድል እና የቅንጦት ፍጹም ውህደት።"\n\n` +
      `👑 "Buna Bingo, Play, Win: The Royal Buna Way."\n` +
      `☕️ "ቡና፣ እየጠጡ ይጫወቱ፣ ያሸንፉ፦ በንጉሳዊው የቡና መንገድ!"\n\n` +
      `☀️🏆 "Buna Bingo — Wake Up to a Jackpot."\n` +
      `💳🏆 "ቡና ቢንጎ — ከጃክፖት ጋር ይንቁ!"\n\n` +
      `Choose an option below:\n` +
      `ከታች አንድ አማራጭ ይምረጡ፡-\n\n` +
      `✉️ <a href="${shareUrl}">Share Invite Link & Earn 5 ETB! (የግብዣ ሊንክዎን ያጋሩ)</a>`;

    await ctx.replyWithPhoto(bannerUrl, {
      caption: mainMenuText,
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        // ── Row 1: Games ─────────────────────────────────────────────────────
        [
          Markup.button.callback('Bingo ይጫወቱ 🎮', 'cmd_play_bingo'),
          Markup.button.callback('Spin ይጫወቱ 🎮',  'cmd_play_spin'),
        ],
        // ── Row 2: Jackpot ───────────────────────────────────────────────────
        [
          Markup.button.webApp('🔥 WIN JACKPOT (ጃክፖት) 🔥', `${config.bot.miniAppUrl}/tickets/select?type=JACKPOT&price=100`),
        ],
        // ── Row 3: Account ───────────────────────────────────────────────────
        [
          Markup.button.callback('ይመዝገቡ Register 📝',  'cmd_register'),
          Markup.button.callback('ብር ያስገቡ Deposit 💵',   'cmd_deposit'),
        ],
        // ── Row 4: Wallet & Support ──────────────────────────────────────────
        [
          Markup.button.callback('ሂሳብ Balance 💰', 'cmd_balance'),
          Markup.button.url('ድጋፍ Support 📞', 'https://t.me/bunabingosupport'),
        ],
        // ── Row 5: Help & Referral ────────────────────────────────────────────
        [
          Markup.button.callback('መመሪያ Instruction 📖', 'cmd_instructions'),
          Markup.button.url(
            'ጋብዝ Invite ✉️',
            shareUrl
          ),
        ],
      ])
    }).catch(() => {
      // Fallback if image fails
      return ctx.reply(mainMenuText, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('Bingo ይጫወቱ 🎮', 'cmd_play_bingo'),
            Markup.button.callback('Spin ይጫወቱ 🎮',  'cmd_play_spin'),
          ],
          [
            Markup.button.webApp('🔥 WIN JACKPOT (ጃክፖት) 🔥', `${config.bot.miniAppUrl}/tickets/select?type=JACKPOT&price=100`),
          ],
          [
            Markup.button.callback('ይመዝገቡ Register 📝',  'cmd_register'),
            Markup.button.callback('ብር ያስገቡ Deposit 💵',   'cmd_deposit'),
          ],
          [
            Markup.button.callback('ሂሳብ Check Balance 💰', 'cmd_balance'),
            Markup.button.url('ድጋፍ Support 📞', 'https://t.me/bunabingosupport'),
          ],
          [
            Markup.button.callback('መመሪያ Instruction 📖', 'cmd_instructions'),
            Markup.button.url(
              'ጋብዝ Invite ✉️',
              shareUrl
            ),
          ],
        ])
      });
    });

    // Send persistent bottom keyboard menu
    await ctx.reply('🎮 የጨዋታ አማራጮችን ከታች ካለው ዝርዝር መምረጥ ይችላሉ።', 
      Markup.keyboard([
        ['🎮 ይጫወቱ'],
        ['💰 ሂሳብ', '📥 ገቢ ለማድረግ'],
        ['📤 ወጪ ለማድረግ', '🔗 ጋብዝ & አግኝ'],
        ['💎 VIP ክፍል', '⭐ Special Promoter'],
        ['🆘 እርዳታ', '📜 ደንቦች']
      ]).resize()
    );

    logger.info(`[Start] Main menu and reply keyboard sent to ${user.id}`);
  } catch (err: any) {
    logger.error('[Start] FATAL ERROR in handleStart:', err);
    if (err.message && err.message.includes('REGISTRATION_BLOCKED_NO_AGENT')) {
      const userMsg = err.message.split('REGISTRATION_BLOCKED_NO_AGENT:')[1].trim();
      await ctx.reply(userMsg);
    } else {
      await ctx.reply('❌ Something went wrong. Please try again.');
    }
  }
}
