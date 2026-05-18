import { Context, Markup } from 'telegraf';
import { config } from '../../config';

export async function handlePlayBingoMenu(ctx: Context) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();

  await ctx.reply(
    `🍀 Best of luck on your Bingo game adventure! 🎮\n` +
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
      // ── Row 3: VIP High-Stakes (Separate at Bottom) ───────────────────────────
      [
        Markup.button.webApp('🎮 Bingo 100 ይጫወቱ', `${config.bot.miniAppUrl}/tickets/select?type=JACKPOT&price=100`),
        Markup.button.webApp('🎮 Bingo 200 ይጫወቱ', `${config.bot.miniAppUrl}/tickets/select?type=VIP&price=200`),
      ],
    ])
  );
}

export async function handleVipRoom(ctx: Context) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();

  const bannerUrl = `${process.env.WEBHOOK_URL}/uploads/banner.png`;
  const messageText = 
    `👑 <b>ወደ ቪአይፒ ክፍል (VIP Room) እንኳን ደህና መጡ!</b> ☕️💎\n\n` +
    `የባለሙያ እና ከፍተኛ ተጫዋቾች መገኛ! እዚህ ክፍል ውስጥ ከ 1 እስከ 50 ካርቴላዎች ብቻ የሚሸጡ ሲሆን ጨዋታዎች በከፍተኛ መጠን የሚካሄዱበት ነው።\n\n` +
    `ከታች ካሉት የ VIP ክፍሎች አንዱን በመምረጥ በቀጥታ ይጫወቱ!`;

  return ctx.replyWithPhoto(bannerUrl, {
    caption: messageText,
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [
        Markup.button.webApp('👑 VIP 100 ይጫወቱ', `${config.bot.miniAppUrl}/tickets/select?type=JACKPOT&price=100`),
        Markup.button.webApp('👑 VIP 200 ይጫወቱ', `${config.bot.miniAppUrl}/tickets/select?type=VIP&price=200`)
      ],
      [Markup.button.callback('📊 ሂሳብ Check Balance', 'cmd_balance')],
    ]),
  }).catch(() => {
    return ctx.reply(messageText, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.webApp('👑 VIP 100 ይጫወቱ', `${config.bot.miniAppUrl}/tickets/select?type=JACKPOT&price=100`),
          Markup.button.webApp('👑 VIP 200 ይጫወቱ', `${config.bot.miniAppUrl}/tickets/select?type=VIP&price=200`)
        ],
        [Markup.button.callback('📊 ሂሳብ Check Balance', 'cmd_balance')],
      ]),
    });
  });
}
