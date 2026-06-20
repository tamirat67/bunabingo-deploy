import { Context, Markup } from 'telegraf';
import { findOrCreateUser, getUserById } from '../../services/user.service';
import { getOrCreateWallet } from '../../services/wallet.service';
import { config } from '../../config';
import { logger } from '../../lib/logger';
import { getJackpot } from '../../services/jackpot.service';

export async function handleStart(ctx: Context) {
  const tgUser = ctx.from!;
  const messageText = (ctx.message as any)?.text || '';
  const startPayload = (ctx as any).payload || messageText.split(' ')[1] || (ctx as any).startPayload as string | undefined;

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

    if (startPayload && startPayload !== tgUser.id.toString()) {
      try {
        let referrer = null;
        if (startPayload.length > 20) {
          // UUID format — look up by id directly
          referrer = await getUserById(startPayload);
        } else if (startPayload.startsWith('AG-')) {
          // Referral code format (e.g. AG-X7K2P) — look up agent by referralCode
          referrer = await (await import('../../lib/prisma')).default.user.findUnique({
            where: { referralCode: startPayload },
            include: { wallet: true, _count: { select: { referrals: true } } }
          });
        } else if (!isNaN(Number(startPayload))) {
          // Telegram ID format
          const { getUserByTelegramId } = await import('../../services/user.service');
          referrer = await getUserByTelegramId(Number(startPayload));
        }

        if (referrer && Number(referrer.telegramId) !== tgUser.id) {
          referrerName    = (referrer as any).firstName;
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
      validReferrerId,
      undefined
    );

    await getOrCreateWallet(user.id);

    // ── 2b. If no explicit referrer from link, resolve the auto-assigned agent ──
    // This covers cases where a user registers directly (no referral link) but
    // gets auto-linked to the default agent inside findOrCreateUser.
    if (!referrerName && user.referredBy) {
      try {
        const assignedAgent = await getUserById(user.referredBy);
        if (assignedAgent) {
          referrerName = assignedAgent.telegramUsername
            ? `@${assignedAgent.telegramUsername}`
            : (assignedAgent.firstName || 'Agent');
        }
      } catch {
        // Non-critical — just log without agent name
      }
    }

    // ── 3a. Phone not yet collected → smart contextual contact-share prompt ────
    if (!(user as any).phone) {
      logger.info(`[Start] User ${tgUser.id} needs phone. Referred by: ${referrerName ?? 'none (direct)'}`);

      // Build message depending on whether they came via invite link
      const message = referrerName
        ? // ── Invited user path ───────────────────────────────────────────────
          `🎉 <b>${referrerName}</b> ወደ <b>ቡና ቢንጎ</b> ጋብዞዎታል!\n` +
          `እንኳን በደህና መጡ!\n\n` +
          `☕️ <i>"ይጎንጩ፣ ይጫወቱ፣ ያሸንፉ፦ በንጉሳዊው የቡና መንገድ!"</i>\n\n` +
          `✨ <b>አሁኑኑ ይቀላቀሉ እና ሁለታችሁም የ 5 ብር ቦነስ ያግኙ!</b>\n\n` +
          `ለመቀጠል እባክዎ ከታች ያለውን ቁልፍ በመጫን ስልክ ቁጥርዎን ያጋሩ፡-`
        : // ── Organic / direct user path ──────────────────────────────────────
          `👋 ወደ <b>ቡና ቢንጎ</b> እንኳን በደህና መጡ፣ ${tgUser.first_name}!\n\n` +
          `☕️ <i>"የቡና ጣዕም፣ ወርቃማ ድሎች።"</i>\n\n` +
          `ለመቀጠል እባክዎ ከታች ያለውን ቁልፍ በመጫን ስልክ ቁጥርዎን ያጋሩ፡-`;

      const bannerUrl = `${process.env.WEBHOOK_URL}/uploads/banner.png`;

      return ctx.replyWithPhoto(bannerUrl, {
        caption: message,
        parse_mode: 'HTML',
        ...Markup.keyboard([
          [Markup.button.contactRequest('📱 ስልክ ቁጥር ያጋሩ')],
        ]).oneTime().resize(),
      }).catch(() => {
        // Fallback if image fails to load
        return ctx.reply(message, {
          parse_mode: 'HTML',
          ...Markup.keyboard([
            [Markup.button.contactRequest('📱 ስልክ ቁጥር ያጋሩ')],
          ]).oneTime().resize(),
        });
      });
    }

    // ── 3b. Phone already saved → show main menu ──────────────────────────────
    const startParam = (user as any).referralCode || user.id;
    const botUsername2 = 'buna_bingobot';
    const inviteLink   = `https://t.me/${botUsername2}?start=${startParam}`;
    const shareMessage = encodeURIComponent(
      `🎰 ቡና ቢንጎ ላይ አብረን እንጫወት! ☕️ ሁለታችንም የ 5 ብር ቦነስ እናገኛለን!\n\n`
    );
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${shareMessage}`;

    logger.info(`[Start] Showing main menu to ${tgUser.id} (${tgUser.first_name})`);

    const jackpot = await getJackpot();
    const jackpotAmount = Number(jackpot.currentAmount).toFixed(2);
    const targetAmount = Number(jackpot.targetAmount).toFixed(2);

    // ── 4. Welcome Splash ────────────────────────────────────────────────────
    const welcomeSplashText =
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `☕️✨ <b>እንኳን ደህና መጡ!</b> ✨☕️\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🎰 <b>ቡና ቢንጎ</b> — <i>የቡና ጣዕም፣ ወርቃማ ድሎች።</i>\n\n` +
      `👤 <b>${tgUser.first_name}${tgUser.username ? ` (@${tgUser.username})` : ''}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔥 <b>ያሁኑ ጃክፖት፡ ${jackpotAmount} ETB</b>\n` +
      `🎯 <b>ግብ (Target)፡ ${targetAmount} ETB</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `⬇️ <i>ከታች ካለው ዝርዝር ይምረጡ</i> ⬇️`;

    const bannerUrl = `${process.env.WEBHOOK_URL}/uploads/banner.png`;

    await ctx.replyWithPhoto(bannerUrl, {
      caption: welcomeSplashText,
      parse_mode: 'HTML',
    }).catch(() => ctx.reply(welcomeSplashText, { parse_mode: 'HTML' }));


    const jackpotSplashText = 
      `🏆 <b>የደራሽ ጃክፖት (Derash Jackpot)</b> 🏆\n\n` +
      `🎉 <b>ታላቅ ዜና!</b>\n` +
      `የጃክፖት ሽልማት አሁን ተጀምሯል! 💰\n\n` +
      `🔥 <b>ያሁኑ ጃክፖት፡ ${jackpotAmount} ETB</b> 🔥\n` +
      `🎯 <b>ግብ (Target)፡ ${targetAmount} ETB</b>\n\n` +
      `በመጫወት የጃክፖት ሽልማት አሸናፊ ይሁኑ! መልካም እድል! 🍀\n\n` +
      `👉👉 <b>የደራሽ ጃክፖት አሰራር!</b>\n\n` +
      `💰 1️⃣ በእያንዳንዱ ጨዋታ የሚሰበሰበው መደብ ከ100 ሲበልጥ ከደራሹ ላይ የተወሰነ ፐርሰንት ወደ ጃክፖቱ ይተላለፋል።\n` +
      `📈 2️⃣ ጃክፖቱ የታለመለትን መጠን (Target Amount) እስኪሞላ ድረስ መጠኑ ይጨምራል። 💥\n` +
      `🎯 3️⃣ ልክ ታርጌቱ ሲሞላ፣ ጃክፖቱ ይፈነዳል!\n` +
      `🔓 4️⃣ በዛ ሰዓት ያሸነፈው እድለኛ ተጫዋች ጠቅላላውን ጃክፖት + መደበኛውን ሽልማት ይወስዳል! 🏆\n\n` +
      `🏆 እድሉን ይሞክሩ! መልካም እድል! 🍀\n\n` +
      `📌 <i>ጠቃሚ ምክር፡ ፈጣን መዳረሻ ለማግኘት ይህንን ቦት ፒን (Pin) ያድርጉት!</i>`;

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


    const mainMenuText = 
      `👋 እንኳን ወደ ቡና ቢንጎ በደህና መጡ፣ <b>${tgUser.first_name}${tgUser.username ? ` @${tgUser.username}` : ''} 🦅</b>!\n\n` +
      `📢 <b>የቡና ቢንጎ ቻናል (Buna Bingo Channel)፡</b> <a href="https://t.me/buna_bingobot1">ይቀላቀሉ!</a>\n\n` +
      `ቡና ቢንጎ ጨዋታ ደምቋል! እየተዝናኑ ለማሸነፍ ዝግጁ ኖት? 🎰☕️\n\n` +
      `🔥 <b>ያሁኑ ጃክፖት፡ ${jackpotAmount} ETB</b> 🔥\n\n` +
      `☕️ "የቡና ጣዕም፣ ወርቃማ ድሎች።"\n\n` +
      `ከታች ካሉት አማራጮች አንዱን ይምረጡ፡-\n\n` +
      `✉️ <a href="${shareUrl}">የግብዣ ሊንክዎን ያጋሩ እና 5 ብር ያግኙ!</a>`;

    await ctx.replyWithPhoto(bannerUrl, {
      caption: mainMenuText,
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        // ── Top Row: Open App ────────────────────────────────────────────────
        [
          Markup.button.webApp('🚀 Open App / አፕ ክፈት', config.bot.miniAppUrl),
        ],
        // ── Row 1: Games ─────────────────────────────────────────────────────
        [
          Markup.button.callback('Bingo ይጫወቱ 🎮', 'cmd_play_bingo'),
        ],

        // ── Row 3: Account ───────────────────────────────────────────────────
        [
          Markup.button.callback('ይመዝገቡ 📝',  'cmd_register'),
          Markup.button.callback('ብር ያስገቡ 💵',   'cmd_deposit'),
        ],
        // ── Row 4: Wallet & Support ──────────────────────────────────────────
        [
          Markup.button.callback('ሂሳብ ማውጫ 💰', 'cmd_balance'),
          Markup.button.url('ድጋፍ ያግኙ 📞', 'https://t.me/Luel1616'),
        ],
        // ── Row 5: Channel ───────────────────────────────────────────────────
        [
          Markup.button.url('📢 ቻናላችንን ይቀላቀሉ (Join Channel)', 'https://t.me/buna_bingobot1'),
        ],
        // ── Row 6: Help & Referral ────────────────────────────────────────────
        [
          Markup.button.callback('አጠቃቀም መመሪያ 📖', 'cmd_instructions'),
          Markup.button.url(
            'ጓደኛ ይጋብዙ ✉️',
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
            Markup.button.webApp('🚀 Open App / አፕ ክፈት', config.bot.miniAppUrl),
          ],
          [
            Markup.button.callback('Bingo ይጫወቱ 🎮', 'cmd_play_bingo'),
          ],

          [
            Markup.button.callback('ይመዝገቡ 📝',  'cmd_register'),
            Markup.button.callback('ብር ያስገቡ 💵',   'cmd_deposit'),
          ],
          [
            Markup.button.callback('ሂሳብ ማውጫ 💰', 'cmd_balance'),
            Markup.button.url('ድጋፍ ያግኙ 📞', 'https://t.me/Luel1616'),
          ],
          [
            Markup.button.url('📢 ቻናላችንን ይቀላቀሉ (Join Channel)', 'https://t.me/buna_bingobot1'),
          ],
          [
            Markup.button.callback('አጠቃቀም መመሪያ 📖', 'cmd_instructions'),
            Markup.button.url(
              'ጓደኛ ይጋብዙ ✉️',
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
        ['💎 VIP ክፍል'],
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
      await ctx.reply('❌ ችግር ተከስቷል፣ እባክዎ እንደገና ይሞክሩ።');
    }
  }
}
