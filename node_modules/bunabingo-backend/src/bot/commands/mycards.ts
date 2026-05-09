import { Context, Markup } from 'telegraf';
import { getUserByTelegramId } from '../../services/user.service';
import { config } from '../../config';
import prisma from '../../lib/prisma';

export async function handleMyCards(ctx: Context) {
  const tgUser = ctx.from!;
  try {
    const user = await getUserByTelegramId(tgUser.id);
    if (!user) return ctx.reply('❌ Please /start first.');

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
        `🃏 *My Cards*\n\nYou have no tickets yet.\nBuy one with /buyticket!`,
        { parse_mode: 'Markdown' }
      );
    }

    let msg = `🃏 *My Recent Cards*\n\n`;
    for (const ticket of tickets) {
      const status =
        ticket.game.status === 'RUNNING' ? '🟢 LIVE' :
        ticket.game.status === 'FINISHED' ? (ticket.isWinner ? '🏆 WON' : '❌ Lost') :
        ticket.game.status === 'WAITING' ? '⏳ Waiting' :
        ticket.game.status === 'COUNTDOWN' ? '⏱ Starting' :
        '🚫 Cancelled';

      msg += `🎮 *${ticket.game.room.type}* — ${status}\n`;
      msg += `📅 ${ticket.purchasedAt.toLocaleDateString()}\n\n`;
    }

    await ctx.reply(msg, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🃏 View All Cards', `${config.bot.miniAppUrl}/tickets`)],
      ]),
    });
  } catch {
    await ctx.reply('❌ Error loading cards.');
  }
}

export async function handleResults(ctx: Context) {
  const tgUser = ctx.from!;
  try {
    const user = await getUserByTelegramId(tgUser.id);
    if (!user) return ctx.reply('❌ Please /start first.');

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

    let msg = `📊 *My Results*\n\n`;

    if (recentWins.length) {
      msg += `🏆 *Recent Wins:*\n`;
      for (const w of recentWins) {
        msg += `• ${w.winMode} — +${Number(w.prizeAmount).toFixed(2)} ETB (${w.game.room.type})\n`;
      }
      msg += '\n';
    } else {
      msg += `🏆 No wins yet — keep playing!\n\n`;
    }

    msg += `🎮 *Recent Games:*\n`;
    for (const t of recentGames) {
      const result = t.isWinner ? '🏆 Won' : t.game.status === 'FINISHED' ? '❌ Lost' : '⏳ Active';
      msg += `• ${t.game.room.type} — ${result}\n`;
    }

    await ctx.reply(msg, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('📊 Full History', `${config.bot.miniAppUrl}/history`)],
      ]),
    });
  } catch {
    await ctx.reply('❌ Error fetching results.');
  }
}
