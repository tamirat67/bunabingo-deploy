import { Context, Markup } from 'telegraf';
import { getUserByTelegramId } from '../../services/user.service';
import { logger } from '../../lib/logger';
import prisma from '../../lib/prisma';

const PAGE_SIZE = 5;

// ─── /game_history ────────────────────────────────────────────────────────────
export async function handleGameHistory(ctx: Context, page = 1) {
  const tgUser = ctx.from!;

  try {
    if (ctx.callbackQuery) await ctx.answerCbQuery();

    const user = await getUserByTelegramId(tgUser.id);
    if (!user) return ctx.reply('❌ እባክዎ አስቀድመው /start ን በመጫን ይመዝገቡ።');

    const skip = (page - 1) * PAGE_SIZE;

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where: { userId: user.id },
        orderBy: { purchasedAt: 'desc' },
        skip,
        take: PAGE_SIZE,
        include: {
          game: {
            include: {
              room: true,
              winners: { where: { userId: user.id } },
            },
          },
        },
      }),
      prisma.ticket.count({ where: { userId: user.id } }),
    ]);

    if (!tickets.length) {
      return ctx.reply(
        `🎮 <b>የጨዋታ ታሪክ</b>\n\n` +
        `እስካሁን ምንም ጨዋታ አልተጫወቱም።\n` +
        `ለመጫወት የ /playbingo ወይም /playspin ትዕዛዞችን ይጠቀሙ!`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🎮 ቢንጎ ይጫወቱ', 'cmd_play_bingo')],
            [Markup.button.callback('🎰 ስፒን ይጫወቱ',  'cmd_play_spin')],
          ]),
        }
      );
    }

    const totalPages = Math.ceil(total / PAGE_SIZE);

    // Build history lines
    const lines = tickets.map((ticket, i) => {
      const gameNum   = skip + i + 1;
      const roomType  = ticket.game.room.type;
      const status    = ticket.game.status;
      const won       = ticket.isWinner;
      const prize     = ticket.game.winners[0]?.prizeAmount;
      const date      = ticket.purchasedAt.toLocaleDateString('en-ET', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });

      const resultIcon = won ? '🏆' : status === 'FINISHED' ? '❌' : '⏳';
      const prizeStr   = won && prize ? ` +${Number(prize).toFixed(2)} ብር (ETB)` : '';
      const ticketPrice = Number(ticket.game.room.ticketPrice);

      return (
        `${gameNum}. ${resultIcon} <b>${roomType}</b> — ${ticketPrice === 0 ? 'ሙከራ (Demo)' : `${ticketPrice} ብር (ETB)`}\n` +
        `   📅 ${date}${prizeStr}`
      );
    });

    // Pagination buttons
    const navButtons = [];
    if (page > 1)          navButtons.push(Markup.button.callback('◀️ ቀዳሚ', `gh_page_${page - 1}`));
    if (page < totalPages) navButtons.push(Markup.button.callback('ቀጣይ ▶️', `gh_page_${page + 1}`));

    const keyboard = [];
    if (navButtons.length) keyboard.push(navButtons);

    const replyText =
      `🎮 <b>የጨዋታ ታሪክ</b>  (ገጽ ${page}/${totalPages})\n` +
      `ጠቅላላ ጨዋታዎች፡ ${total}\n\n` +
      lines.join('\n\n');

    if (ctx.callbackQuery) {
      await ctx.editMessageText(replyText, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(keyboard),
      });
    } else {
      await ctx.reply(replyText, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(keyboard),
      });
    }
  } catch (err: any) {
    logger.error('[GameHistory] Error:', err);
    await ctx.reply('❌ የጨዋታ ታሪክዎን መጫን አልተቻለም። እባክዎ እንደገና ይሞክሩ።');
  }
}
