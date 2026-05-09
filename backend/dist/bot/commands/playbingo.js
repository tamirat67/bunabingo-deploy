"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePlayBingoMenu = handlePlayBingoMenu;
const telegraf_1 = require("telegraf");
const config_1 = require("../../config");
async function handlePlayBingoMenu(ctx) {
    const text = `🍀 Best of luck on your Bingo game adventure! 🎮`;
    const keyboard = telegraf_1.Markup.inlineKeyboard([
        [
            telegraf_1.Markup.button.webApp('🎮 Play Bingo 10', `${config_1.config.bot.miniAppUrl}/game?bet=10`),
            telegraf_1.Markup.button.webApp('🎮 Play Bingo 20', `${config_1.config.bot.miniAppUrl}/game?bet=20`),
        ],
        [
            telegraf_1.Markup.button.webApp('🎮 Play Bingo 50', `${config_1.config.bot.miniAppUrl}/game?bet=50`),
            telegraf_1.Markup.button.webApp('🎮 Play Bingo 100', `${config_1.config.bot.miniAppUrl}/game?bet=100`),
        ],
        [
            telegraf_1.Markup.button.webApp('🎮 Play Bingo Demo', `${config_1.config.bot.miniAppUrl}/game?mode=demo`),
        ],
    ]);
    if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
        await ctx.reply(text, keyboard);
    }
    else {
        await ctx.reply(text, keyboard);
    }
}
//# sourceMappingURL=playbingo.js.map