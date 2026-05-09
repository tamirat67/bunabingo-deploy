"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePlaySpinMenu = handlePlaySpinMenu;
const telegraf_1 = require("telegraf");
const config_1 = require("../../config");
async function handlePlaySpinMenu(ctx) {
    const text = `🍀 Best of luck on your Spin game adventure! 🎮`;
    const keyboard = telegraf_1.Markup.inlineKeyboard([
        [
            telegraf_1.Markup.button.webApp('🎮 Play Spin 10', `${config_1.config.bot.miniAppUrl}/spin?bet=10`),
            telegraf_1.Markup.button.webApp('🎮 Play Spin 20', `${config_1.config.bot.miniAppUrl}/spin?bet=20`),
        ],
        [
            telegraf_1.Markup.button.webApp('🎮 Play Spin 50', `${config_1.config.bot.miniAppUrl}/spin?bet=50`),
            telegraf_1.Markup.button.webApp('🎮 Play Spin 100', `${config_1.config.bot.miniAppUrl}/spin?bet=100`),
        ],
        [
            telegraf_1.Markup.button.webApp('🎮 Play Spin Demo', `${config_1.config.bot.miniAppUrl}/spin?mode=demo`),
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
//# sourceMappingURL=playspin.js.map