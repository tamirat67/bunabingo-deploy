import { Context, Markup } from 'telegraf';
import { config } from '../../config';

export async function handlePlayBingoMenu(ctx: Context) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();

  await ctx.reply(
    `🍀 ለቢንጎ ጨዋታዎ መልካም እድል! 🎮`,
    Markup.inlineKeyboard([
      // ── Row 1: Low-Stakes ──────────────────────────────────────────────────────
      [
        Markup.button.webApp('🎮 Bingo 10 ይጫወቱ', `${config.bot.miniAppUrl}/tickets/select?type=CASUAL&price=10`),
        Markup.button.webApp('🎮 Bingo 20 ይጫወቱ', `${config.bot.miniAppUrl}/tickets/select?type=STANDARD&price=20`),
      ],
      // ── Row 2: Mid-Stakes & Practice ──────────────────────────────────────────
      [
        Markup.button.webApp('🎮 Bingo 50 ይጫወቱ', `${config.bot.miniAppUrl}/tickets/select?type=PRO&price=50`),
        Markup.button.webApp('🎮 በነጻ ይሞክሩ (Demo)', `${config.bot.miniAppUrl}/tickets/select?type=DEMO&price=0`),
      ],
      // ── Row 3: VIP Room ───────────────────────────────────────────────────────
      [
        Markup.button.callback('💎 VIP ክፍል', 'cmd_vip'),
      ],
    ])
  );
}

export async function handleVipRoom(ctx: Context) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();

  const bannerUrl = `${process.env.WEBHOOK_URL}/uploads/banner.png`;
  const messageText = 
    `👑 <b>ወደ VIP ክፍል እንኳን ደህና መጡ!</b> ☕️💎\n\n` +
    `የባለሙያ እና ከፍተኛ ተጫዋቾች መገኛ! እዚህ ክፍል ውስጥ ከ 1 እስከ 50 ካርቴላዎች ብቻ የሚሸጡ ሲሆን ጨዋታዎች በከፍተኛ መጠን የሚካሄዱበት ነው።\n\n` +
    `ከታች ካሉት የ VIP ክፍሎች አንዱን በመምረጥ በቀጥታ ይጫወቱ!`;

  return ctx.replyWithPhoto(bannerUrl, {
    caption: messageText,
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [
        Markup.button.webApp('👑 VIP ክፍል 100', `${config.bot.miniAppUrl}/tickets/select?type=JACKPOT&price=100`),
        Markup.button.webApp('👑 VIP ክፍል 200', `${config.bot.miniAppUrl}/tickets/select?type=VIP&price=200`)
      ],
      [Markup.button.callback('📊 ሂሳብ', 'cmd_balance')],
    ]),
  }).catch(() => {
    return ctx.reply(messageText, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.webApp('👑 VIP ክፍል 100', `${config.bot.miniAppUrl}/tickets/select?type=JACKPOT&price=100`),
          Markup.button.webApp('👑 VIP ክፍል 200', `${config.bot.miniAppUrl}/tickets/select?type=VIP&price=200`)
        ],
        [Markup.button.callback('📊 ሂሳብ', 'cmd_balance')],
      ]),
    });
  });
}
