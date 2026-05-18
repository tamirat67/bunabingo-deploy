import { Context, Markup } from 'telegraf';
import { getUserByTelegramId } from '../../services/user.service';
import { config } from '../../config';
import prisma from '../../lib/prisma';

export async function handleMyCards(ctx: Context) {
  const tgUser = ctx.from!;
  try {
    const user = await getUserByTelegramId(tgUser.id);
    if (!user) return ctx.reply('❌ እባክዎ አስቀድመው /start ን በመጫን ይመዝገቡ።');

    const tickets = await prisma.ticket.findMany({
      where: { userId: user.id },
      include: {
        game: { include: { room: true } },
        winners: true,
      },
      orderBy: { purchasedAt: 'desc' },
      take: 5,
    });

    if (!tickets.length) {
      return ctx.reply(
        `🃏 *የእኔ ካርዶች*\n\nእስካሁን ምንም ቲኬት የለዎትም።\nበ /buyticket መግዛት ይችላሉ!`,
        { parse_mode: 'Markdown' }
      );
    }

    let msg = `🃏 *የቅርብ ጊዜ ካርዶች*\n\n`;
    for (const ticket of tickets) {
      const status =
        ticket.game.status === 'RUNNING' ? '🟢 የቀጥታ ጨዋታ' :
        ticket.game.status === 'FINISHED' ? (ticket.isWinner ? '🏆 አሸንፈዋል' : '❌ አልደረሰዎትም') :
        ticket.game.status === 'WAITING' ? '⏳ በመጠባበቅ ላይ' :
        ticket.game.status === 'COUNTDOWN' ? '⏱ ሊጀምር ነው' :
        '🚫 ተሰርዟል';

      msg += `🎮 *${ticket.game.room.type}* — ${status}\n`;
      msg += `📅 ${ticket.purchasedAt.toLocaleDateString()}\n\n`;
    }

    await ctx.reply(msg, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🃏 ሁሉንም ካርዶች ይመልከቱ', `${config.bot.miniAppUrl}/tickets`)],
      ]),
    });
  } catch {
    await ctx.reply('❌ ካርዶችን መጫን አልተቻለም።');
  }
}

export async function handleResults(ctx: Context) {
  const tgUser = ctx.from!;
  try {
    const user = await getUserByTelegramId(tgUser.id);
    if (!user) return ctx.reply('❌ እባክዎ አስቀድመው /start ን በመጫን ይመዝገቡ።');

    const recentWins = await prisma.winner.findMany({
      where: { userId: user.id },
      include: { game: { include: { room: true } } },
      orderBy: { paidAt: 'desc' },
      take: 5,
    });

    const recentGames = await prisma.ticket.findMany({
      where: { userId: user.id },
      include: { game: { include: { room: true, winners: true } } },
      orderBy: { purchasedAt: 'desc' },
      take: 5,
    });

    let msg = `📊 *ውጤቶቼ*\n\n`;

    if (recentWins.length) {
      msg += `🏆 *የቅርብ ጊዜ አሸናፊዎች:*\n`;
      for (const w of recentWins) {
        msg += `• ${w.winMode} — +${Number(w.prizeAmount).toFixed(2)} ብር (ETB) (${w.game.room.type})\n`;
      }
      msg += '\n';
    } else {
      msg += `🏆 እስካሁን ምንም ድል የለም — መጫወትዎን ይቀጥሉ!\n\n`;
    }

    msg += `🎮 *የቅርብ ጊዜ ጨዋታዎች:*\n`;
    for (const t of recentGames) {
      const result = t.isWinner ? '🏆 አሸንፈዋል' : t.game.status === 'FINISHED' ? '❌ አልደረሰዎትም' : '⏳ ገቢር';
      msg += `• ${t.game.room.type} — ${result}\n`;
    }

    await ctx.reply(msg, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('📊 ሙሉ ታሪክ', `${config.bot.miniAppUrl}/history`)],
      ]),
    });
  } catch {
    await ctx.reply('❌ ውጤቶችን ማምጣት አልተቻለም።');
  }
}
