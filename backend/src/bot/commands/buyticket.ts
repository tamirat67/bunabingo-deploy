import { Context, Markup } from 'telegraf';
import { getUserByTelegramId } from '../../services/user.service';
import { getRooms } from '../../game/room.manager';
import { joinGame } from '../../game/engine';
import { config } from '../../config';

const ROOM_LABELS: Record<string, string> = {
  CASUAL: '🟢 Casual (መደበኛ)',
  STANDARD: '🔵 Standard (ከፍተኛ)',
  JACKPOT: '💎 Jackpot (ጃክፖት)',
};

export async function handleBuyTicket(ctx: Context) {
  const tgUser = ctx.from!;

  try {
    const user = await getUserByTelegramId(tgUser.id);
    if (!user) return ctx.reply('❌ Please /start first to register.');
    
    if (!user.phoneNumber) {
      return ctx.reply(
        `📱 <b>የስልክ ማረጋገጫ ያስፈልጋል (Phone Verification Required)</b>\n\nጨዋታ ለመቀላቀል እባክዎ ከታች ያለውን ቁልፍ በመጫን ስልክዎን ያጋሩ።`,
        {
          parse_mode: 'HTML',
          ...Markup.keyboard([
            [Markup.button.contactRequest('📱 ስልክ ያጋሩ (Share Phone Number)')]
          ]).oneTime().resize()
        }
      );
    }

    const rooms = await getRooms();

    const roomButtons = rooms.map(room => {
      const activeGame = room.games[0];
      const players = activeGame?.tickets?.length ?? 0;
      const label = ROOM_LABELS[room.type] || room.type;
      const price = Number(room.ticketPrice).toFixed(0);
      return [Markup.button.callback(
        `${label} — ${price} ብር (${players} ተጫዋቾች)`,
        `join_${room.type}`
      )];
    });

    await ctx.reply(
      `🎫 *Bingo Ticket ይግዙ*\n\n` +
      `ለመቀላቀል የሚፈልጉትን ክፍል ይምረጡ፡-\n\n` +
      `🟢 *Casual* — 10 ብር · 30 ሴኮንድ\n` +
      `🔵 *Standard* — 25 ብር · 15 ሴኮንድ\n` +
      `💎 *Jackpot* — 100 ብር · 5 ሴኮንድ\n\n` +
      `አነስተኛው የተጫዋች ቁጥር ሲሞላ ጨዋታው በራሱ ይጀምራል!`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          ...roomButtons,
          [Markup.button.webApp('🎮 በ Mini App ይጫወቱ', `${config.bot.miniAppUrl}/tickets`) as any],
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
    
    if (!user.phoneNumber) {
      await ctx.answerCbQuery('❌ የስልክ ማረጋገጫ ያስፈልጋል!');
      return ctx.reply(
        `📱 <b>የስልክ ማረጋገጫ ያስፈልጋል</b>\n\nጨዋታ ለመቀላቀል እባክዎ ስልክዎን ያጋሩ።`,
        {
          parse_mode: 'HTML',
          ...Markup.keyboard([
            [Markup.button.contactRequest('📱 ስልክ ያጋሩ (Share Phone Number)')]
          ]).oneTime().resize()
        }
      );
    }

    const { getRoomWithActiveGame } = await import('../../game/room.manager');
    const room = await getRoomWithActiveGame(roomType as any);
    if (!room) {
      await ctx.answerCbQuery('❌ Room not found.');
      return;
    }

    let activeGame = room.games[0];
    if (!activeGame) {
      const { createWaitingGame } = await import('../../game/engine');
      const newGameId = await createWaitingGame(room.id);
      activeGame = { id: newGameId } as any;
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

    await ctx.answerCbQuery('🎫 ተቀላቅለዋል! መልካም እድል!');
    await ctx.reply(
      `✅ *${ROOM_LABELS[roomType]} ተቀላቅለዋል!*\n\n` +
      `🃏 የእርስዎ የቢንጎ ካርድ (Card):\n` +
      `\`B  | I  | N  | G  | O\n` +
      `${cardDisplay}\`\n\n` +
      `⏳ ሌሎች ተጫዋቾችን እየጠበቅን ነው...\n` +
      `📱 በ Mini App በቀጥታ ይጫወቱ!`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🎮 በቀጥታ ይጫወቱ (Play Live)', `${config.bot.miniAppUrl}/game?id=${activeGame.id}`)],
        ]),
      }
    );
  } catch (err: any) {
    await ctx.answerCbQuery(`❌ ${err.message || 'Error joining game'}`);
  }
}
