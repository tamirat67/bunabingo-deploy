import { Context, Markup } from 'telegraf';
import { getUserByTelegramId } from '../../services/user.service';
import { getRooms } from '../../game/room.manager';
import { joinGame } from '../../game/engine';
import { config } from '../../config';

const ROOM_LABELS: Record<string, string> = {
  CASUAL: '🟢 Casual Room',
  STANDARD: '🔵 Standard Room',
  JACKPOT: '💎 Jackpot Room',
};

export async function handleBuyTicket(ctx: Context) {
  const tgUser = ctx.from!;

  try {
    const user = await getUserByTelegramId(tgUser.id);
    if (!user) return ctx.reply('❌ Please /start first to register.');

    const rooms = await getRooms();

    const roomButtons = rooms.map(room => {
      const activeGame = room.games[0];
      const players = activeGame?.tickets?.length ?? 0;
      const label = ROOM_LABELS[room.type] || room.type;
      const price = Number(room.ticketPrice).toFixed(0);
      return [Markup.button.callback(
        `${label} — ${price} ETB (${players} players)`,
        `join_${room.type}`
      )];
    });

    await ctx.reply(
      `🎫 *Buy Bingo Ticket*\n\n` +
      `Choose a room to join:\n\n` +
      `🟢 *Casual* — 2+ players · 10 ETB · 30s countdown\n` +
      `🔵 *Standard* — 5+ players · 25 ETB · 15s countdown\n` +
      `💎 *Jackpot* — 20+ players · 100 ETB · 5s countdown\n\n` +
      `Game starts automatically when minimum players join!`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          ...roomButtons,
          [Markup.button.webApp('🎮 Open in Mini App', `${config.bot.miniAppUrl}/tickets`) as any],
        ]),
      }
    );
  } catch (err) {
    await ctx.reply('❌ Error loading rooms. Please try again.');
  }
}

export async function handleJoinRoom(ctx: Context, roomType: string) {
  const tgUser = ctx.from!;

  try {
    const user = await getUserByTelegramId(tgUser.id);
    if (!user) return ctx.answerCbQuery('❌ Please /start first.');
    if (user.status === 'BANNED') return ctx.answerCbQuery('❌ Account banned.');
    if (user.status === 'SUSPENDED') return ctx.answerCbQuery('❌ Account suspended.');

    const { getRoomWithActiveGame } = await import('../../game/room.manager');
    const room = await getRoomWithActiveGame(roomType as any);
    if (!room) {
      await ctx.answerCbQuery('❌ Room not found.');
      return;
    }

    const activeGame = room.games[0];
    if (!activeGame) {
      await ctx.answerCbQuery('❌ No active game. Please try again.');
      return;
    }

    const { tickets, cards } = await joinGame(user.id, activeGame.id);
    const ticket = tickets[0];
    const card = cards[0];

    const cardDisplay = card.map((row, r) =>
      row.map((cell, c) => {
        if (cell === 'FREE') return '⭐';
        return String(cell).padStart(2, ' ');
      }).join(' | ')
    ).join('\n');

    await ctx.answerCbQuery('🎫 Joined! Good luck!');
    await ctx.reply(
      `✅ *Joined ${ROOM_LABELS[roomType]}!*\n\n` +
      `🃏 Your Bingo Card:\n` +
      `\`B  | I  | N  | G  | O\n` +
      `${cardDisplay}\`\n\n` +
      `⏳ Waiting for more players...\n` +
      `📱 Open Mini App to play live!`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🎮 Play Live', `${config.bot.miniAppUrl}/game?id=${activeGame.id}`)],
        ]),
      }
    );
  } catch (err: any) {
    await ctx.answerCbQuery(`❌ ${err.message || 'Error joining game'}`);
  }
}
