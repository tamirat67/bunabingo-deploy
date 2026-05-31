import { Context, Markup } from 'telegraf';
import { getUserByTelegramId, isAdmin } from '../../services/user.service';

/**
 * /cmd — Shows all available bot commands in a clean menu.
 * Admin commands only shown to admins.
 */
export async function handleCmd(ctx: Context) {
  const tgUser = ctx.from!;

  // Check if admin for extra commands
  const isAdminUser = isAdmin(tgUser.id);

  const text =
    `📋 <b>ሁሉም ትዕዛዞች (All Commands)</b>\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🎮 <b>ጨዋታ (Games)</b>\n` +
    `  /playbingo — ቢንጎ ይጫወቱ\n` +
    `  /vip — VIP ክፍል\n` +
    `  /mycards — የእኔ ካርቴላዎች\n` +
    `  /results — የጨዋታ ውጤቶች\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 <b>ቦርሳ (Wallet)</b>\n` +
    `  /balance — ሂሳብ ይመልከቱ\n` +
    `  /deposit — ብር ያስገቡ\n` +
    `  /withdraw — ብር ያውጡ\n` +
    `  /transfer — ብር ያስተላልፉ\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>መለያ (Account)</b>\n` +
    `  /register — ይመዝገቡ\n` +
    `  /change_name — ስም ይቀይሩ\n` +
    `  /invite — ጓደኛ ይጋብዙ\n` +
    `  /game_history — የጨዋታ ታሪክ\n` +
    `  /check_transaction — ግብይት ይፈትሹ\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🆘 <b>እርዳታ (Help)</b>\n` +
    `  /instructions — አጠቃቀም መመሪያ\n` +
    `  /support — ድጋፍ\n` +
    `  /start — ዋና ማውጫ\n` +
    (isAdminUser ? (
      `\n━━━━━━━━━━━━━━━━━━━━\n` +
      `🛡️ <b>Admin</b>\n` +
      `  /admin — Admin Panel\n` +
      `  /deposits — Pending Deposits\n` +
      `  /withdrawals — Pending Withdrawals\n`
    ) : '');

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('🎮 ቢንጎ ይጫወቱ', 'cmd_play_bingo'),
        Markup.button.callback('💰 ሂሳብ', 'cmd_balance'),
      ],
      [
        Markup.button.callback('📥 ገቢ ለማድረግ', 'cmd_deposit'),
        Markup.button.callback('📤 ወጪ ለማድረግ', 'cmd_withdraw'),
      ],
      [
        Markup.button.callback('🔗 ጋብዝ & አግኝ', 'cmd_invite'),
        Markup.button.callback('🆘 እርዳታ', 'cmd_support'),
      ],
      [
        Markup.button.callback('🏠 ዋና ማውጫ', 'cmd_start'),
      ],
    ]),
  });
}
