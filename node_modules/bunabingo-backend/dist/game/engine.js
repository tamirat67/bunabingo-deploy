"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startCountdown = startCountdown;
exports.cancelGame = cancelGame;
exports.createWaitingGame = createWaitingGame;
exports.joinGame = joinGame;
exports.getActiveGames = getActiveGames;
const prisma_1 = __importDefault(require("../lib/prisma"));
const logger_1 = require("../lib/logger");
const config_1 = require("../config");
const pusher_1 = require("../lib/pusher");
const card_generator_1 = require("./card.generator");
const library_1 = require("@prisma/client/runtime/library");
const predefinedCards_1 = require("../lib/predefinedCards");
// Local enums since Prisma schema uses String, not Enum
const GameStatus = {
    WAITING: 'WAITING',
    COUNTDOWN: 'COUNTDOWN',
    RUNNING: 'RUNNING',
    FINISHED: 'FINISHED',
    CANCELLED: 'CANCELLED',
};
const activeGames = new Map();
function buildNumberPool() {
    const pool = Array.from({ length: 75 }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
}
function getCountdownSeconds(playerCount) {
    if (playerCount >= 20)
        return 5;
    if (playerCount >= 5)
        return 15;
    return 30;
}
async function startCountdown(gameId, playerCount) {
    const seconds = getCountdownSeconds(playerCount);
    await prisma_1.default.game.update({
        where: { id: gameId },
        data: { status: GameStatus.COUNTDOWN, countdownSeconds: seconds },
    });
    await (0, pusher_1.triggerGameEvent)(gameId, 'countdown-start', { seconds, playerCount });
    logger_1.logger.info(`[Game ${gameId}] Countdown started: ${seconds}s for ${playerCount} players`);
    const timer = setTimeout(() => runGame(gameId), seconds * 1000);
    const existing = activeGames.get(gameId);
    if (existing) {
        existing.countdownTimer = timer;
    }
    else {
        activeGames.set(gameId, {
            gameId,
            roomType: 'CASUAL',
            drawnNumbers: [],
            numberPool: buildNumberPool(),
            countdownTimer: timer,
        });
    }
}
async function runGame(gameId) {
    const game = await prisma_1.default.game.findUnique({
        where: { id: gameId },
        include: { room: true, tickets: true },
    });
    if (!game || game.status === GameStatus.CANCELLED)
        return;
    if (game.tickets.length < 2) {
        await cancelGame(gameId, 'Not enough players when game started');
        return;
    }
    await prisma_1.default.game.update({
        where: { id: gameId },
        data: { status: GameStatus.RUNNING, startedAt: new Date() },
    });
    let state = activeGames.get(gameId);
    if (!state) {
        state = {
            gameId,
            roomType: game.room.type,
            drawnNumbers: [],
            numberPool: buildNumberPool(),
        };
        activeGames.set(gameId, state);
    }
    await (0, pusher_1.triggerGameEvent)(gameId, 'game-started', { gameId, playerCount: game.tickets.length });
    logger_1.logger.info(`[Game ${gameId}] Game RUNNING with ${game.tickets.length} players`);
    state.drawInterval = setInterval(() => drawNumber(gameId), config_1.config.game.drawIntervalMs);
}
async function drawNumber(gameId) {
    const state = activeGames.get(gameId);
    if (!state)
        return;
    if (state.numberPool.length === 0) {
        await finishGame(gameId, 'All numbers drawn');
        return;
    }
    const number = state.numberPool.pop();
    state.drawnNumbers.push(number);
    const sequence = state.drawnNumbers.length;
    await prisma_1.default.drawHistory.create({
        data: { gameId, number, sequence },
    });
    await (0, pusher_1.triggerGameEvent)(gameId, 'number-drawn', {
        number,
        sequence,
        totalDrawn: state.drawnNumbers.length,
    });
    logger_1.logger.debug(`[Game ${gameId}] Drew #${number} (${sequence}th)`);
    await checkAllTickets(gameId, state.drawnNumbers);
}
async function checkAllTickets(gameId, drawnNumbers) {
    const tickets = await prisma_1.default.ticket.findMany({
        where: { gameId, isWinner: false },
        include: { user: true },
    });
    const existingWinners = await prisma_1.default.winner.findMany({ where: { gameId } });
    const existingWinModes = new Set(existingWinners.map(w => w.winMode));
    for (const ticket of tickets) {
        const card = ticket.card;
        if (!card)
            continue;
        const result = (0, card_generator_1.checkWin)(card, drawnNumbers);
        if (result.won) {
            for (const mode of result.modes) {
                if (!existingWinModes.has(mode)) {
                    await processWinner(gameId, ticket.userId, ticket.id, mode, drawnNumbers);
                    existingWinModes.add(mode);
                }
            }
        }
        await prisma_1.default.ticket.update({
            where: { id: ticket.id },
            data: { markedNumbers: drawnNumbers },
        });
    }
    if (existingWinModes.has('FULL_HOUSE')) {
        clearInterval(activeGames.get(gameId)?.drawInterval);
        await finishGame(gameId, 'Full house winner found');
    }
}
async function processWinner(gameId, userId, ticketId, winMode, drawnNumbers) {
    const game = await prisma_1.default.game.findUnique({
        where: { id: gameId },
        include: { tickets: true },
    });
    if (!game)
        return;
    const prizePercents = {
        ROW: 10,
        COLUMN: 10,
        DIAGONAL: 15,
        FOUR_CORNERS: 15,
        FULL_HOUSE: 50,
    };
    const percent = prizePercents[winMode] ?? 10;
    const prizeAmount = new library_1.Decimal(game.totalPrize.toString()).mul(percent).div(100);
    await prisma_1.default.winner.create({
        data: { gameId, userId, ticketId, winMode, prizeAmount },
    });
    const wallet = await prisma_1.default.wallet.findUnique({ where: { userId } });
    if (wallet) {
        const before = wallet.balance;
        const after = new library_1.Decimal(wallet.balance.toString()).add(prizeAmount);
        await prisma_1.default.wallet.update({
            where: { userId },
            data: {
                balance: after,
                totalWon: new library_1.Decimal(wallet.totalWon.toString()).add(prizeAmount),
            },
        });
        await prisma_1.default.transaction.create({
            data: {
                userId,
                type: 'PRIZE_WIN',
                amount: prizeAmount,
                balanceBefore: before,
                balanceAfter: after,
                status: 'COMPLETED',
                referenceId: gameId,
                description: `Bingo WIN: ${winMode}`,
            },
        });
    }
    await prisma_1.default.ticket.update({ where: { id: ticketId }, data: { isWinner: true } });
    await (0, pusher_1.triggerGameEvent)(gameId, 'winner-announced', {
        userId,
        winMode,
        prizeAmount: prizeAmount.toFixed(2),
        drawnNumbers,
    });
    await (0, pusher_1.triggerUserEvent)(userId, 'prize-received', {
        gameId,
        winMode,
        amount: prizeAmount.toFixed(2),
    });
    logger_1.logger.info(`[Game ${gameId}] Winner: user ${userId} — ${winMode} — Prize: ${prizeAmount}`);
}
async function finishGame(gameId, reason) {
    const state = activeGames.get(gameId);
    if (state?.drawInterval)
        clearInterval(state.drawInterval);
    if (state?.countdownTimer)
        clearTimeout(state.countdownTimer);
    activeGames.delete(gameId);
    await prisma_1.default.game.update({
        where: { id: gameId },
        data: { status: GameStatus.FINISHED, finishedAt: new Date() },
    });
    const winners = await prisma_1.default.winner.findMany({
        where: { gameId },
        include: { user: { select: { firstName: true, telegramUsername: true } } },
    });
    await (0, pusher_1.triggerGameEvent)(gameId, 'game-finished', { gameId, reason, winners });
    await (0, pusher_1.triggerAdminEvent)('game-finished', { gameId, reason });
    logger_1.logger.info(`[Game ${gameId}] Finished: ${reason}`);
    const game = await prisma_1.default.game.findUnique({ where: { id: gameId } });
    if (game) {
        await createWaitingGame(game.roomId);
    }
}
async function cancelGame(gameId, reason) {
    const state = activeGames.get(gameId);
    if (state?.drawInterval)
        clearInterval(state.drawInterval);
    if (state?.countdownTimer)
        clearTimeout(state.countdownTimer);
    activeGames.delete(gameId);
    await prisma_1.default.game.update({
        where: { id: gameId },
        data: { status: GameStatus.CANCELLED, cancelledAt: new Date(), cancelReason: reason },
    });
    const tickets = await prisma_1.default.ticket.findMany({ where: { gameId }, include: { user: true } });
    for (const ticket of tickets) {
        const game = await prisma_1.default.game.findUnique({ where: { id: gameId }, include: { room: true } });
        if (!game)
            continue;
        const refundAmount = game.room.ticketPrice;
        const wallet = await prisma_1.default.wallet.findUnique({ where: { userId: ticket.userId } });
        if (!wallet)
            continue;
        const after = new library_1.Decimal(wallet.balance.toString()).add(refundAmount);
        await prisma_1.default.wallet.update({
            where: { userId: ticket.userId },
            data: {
                balance: after,
                totalSpent: new library_1.Decimal(wallet.totalSpent.toString()).sub(refundAmount),
            },
        });
        await prisma_1.default.transaction.create({
            data: {
                userId: ticket.userId,
                type: 'REFUND',
                amount: refundAmount,
                balanceBefore: wallet.balance,
                balanceAfter: after,
                status: 'COMPLETED',
                referenceId: gameId,
                description: `Refund: cancelled game`,
            },
        });
        await (0, pusher_1.triggerUserEvent)(ticket.userId, 'game-cancelled', {
            gameId,
            refundAmount: new library_1.Decimal(refundAmount.toString()).toFixed(2),
            reason,
        });
    }
    await (0, pusher_1.triggerGameEvent)(gameId, 'game-cancelled', { gameId, reason });
    logger_1.logger.info(`[Game ${gameId}] Cancelled: ${reason}`);
}
async function createWaitingGame(roomId) {
    const existing = await prisma_1.default.game.findFirst({
        where: { roomId, status: GameStatus.WAITING },
    });
    if (existing)
        return existing.id;
    const room = await prisma_1.default.room.findUnique({ where: { id: roomId } });
    if (!room)
        throw new Error('Room not found');
    const game = await prisma_1.default.game.create({
        data: {
            roomId,
            status: GameStatus.WAITING,
            totalPrize: 0,
            houseEdge: 0,
        },
    });
    logger_1.logger.info(`[Room ${roomId}] New waiting game created: ${game.id}`);
    return game.id;
}
async function joinGame(userId, gameId, cardIds = [1]) {
    const game = await prisma_1.default.game.findUnique({
        where: { id: gameId },
        include: { room: true, tickets: true },
    });
    if (!game)
        throw new Error('Game not found');
    if (game.status !== GameStatus.WAITING && game.status !== GameStatus.COUNTDOWN) {
        throw new Error('Game is not accepting players');
    }
    const numTickets = cardIds.length;
    if (numTickets === 0)
        throw new Error('No cards selected');
    if (numTickets > 3)
        throw new Error('Maximum of 3 cards allowed per player');
    const existingTicketsCount = await prisma_1.default.ticket.count({ where: { userId, gameId } });
    if (existingTicketsCount + numTickets > 3) {
        throw new Error(`You already have ${existingTicketsCount} tickets. Maximum allowed is 3.`);
    }
    const preparedCards = [];
    for (const cardId of cardIds) {
        const normalizedId = Math.max(1, Math.min(100, cardId));
        const pattern = predefinedCards_1.PREDEFINED_CARDS[normalizedId];
        if (!pattern)
            throw new Error(`Invalid card selection: ${cardId}`);
        preparedCards.push({
            id: normalizedId,
            pattern: pattern.map(row => row.map(cell => (cell === 0 ? 'FREE' : cell))),
        });
    }
    let wallet = await prisma_1.default.wallet.findUnique({ where: { userId } });
    if (!wallet)
        throw new Error('Wallet not found');
    const unitPrice = game.room.ticketPrice;
    const totalPrice = new library_1.Decimal(unitPrice.toString()).mul(numTickets);
    if (new library_1.Decimal(wallet.balance.toString()).lessThan(totalPrice)) {
        // Auto-refill for demo/testing
        const refillAmount = 1000;
        await prisma_1.default.wallet.update({ where: { userId }, data: { balance: refillAmount } });
        await prisma_1.default.transaction.create({
            data: {
                userId,
                type: 'DEPOSIT',
                amount: refillAmount,
                balanceBefore: wallet.balance,
                balanceAfter: refillAmount,
                status: 'COMPLETED',
                description: 'Free test bankroll',
            },
        });
        wallet = await prisma_1.default.wallet.findUnique({ where: { userId } }) ?? wallet;
    }
    const newBalance = new library_1.Decimal(wallet.balance.toString()).sub(totalPrice);
    const totalHouseEdge = new library_1.Decimal(totalPrice.toString()).mul(config_1.config.game.houseEdgePercent).div(100);
    const totalPrizeContribution = new library_1.Decimal(totalPrice.toString()).sub(totalHouseEdge);
    const results = await prisma_1.default.$transaction(async (tx) => {
        await tx.wallet.update({
            where: { userId },
            data: {
                balance: newBalance,
                totalSpent: new library_1.Decimal(wallet.totalSpent.toString()).add(totalPrice),
            },
        });
        await tx.transaction.create({
            data: {
                userId,
                type: 'TICKET_PURCHASE',
                amount: totalPrice,
                balanceBefore: wallet.balance,
                balanceAfter: newBalance,
                status: 'COMPLETED',
                referenceId: gameId,
                description: `Purchased ${numTickets} ticket(s) for ${game.room.type} game`,
            },
        });
        const tickets = await Promise.all(preparedCards.map(c => tx.ticket.create({
            data: {
                userId,
                gameId,
                cartelaId: c.id,
                card: c.pattern,
                markedNumbers: [],
            },
        })));
        await tx.game.update({
            where: { id: gameId },
            data: {
                totalPrize: new library_1.Decimal(game.totalPrize.toString()).add(totalPrizeContribution),
                houseEdge: new library_1.Decimal(game.houseEdge.toString()).add(totalHouseEdge),
            },
        });
        await tx.room.update({
            where: { id: game.roomId },
            data: { currentPlayers: { increment: numTickets } },
        });
        return { tickets };
    });
    const updatedGame = await prisma_1.default.game.findUnique({
        where: { id: gameId },
        include: { tickets: true },
    });
    const playerCount = updatedGame?.tickets.length ?? 0;
    try {
        await (0, pusher_1.triggerGameEvent)(gameId, 'player-joined', { userId, playerCount, numTickets });
        await (0, pusher_1.triggerAdminEvent)('player-joined', { gameId, userId, playerCount });
    }
    catch (e) {
        logger_1.logger.error('Pusher notification failed but join succeeded:', e);
    }
    const minPlayers = game.room.minPlayers;
    const uniquePlayers = await prisma_1.default.ticket.groupBy({ where: { gameId }, by: ['userId'] });
    if (uniquePlayers.length >= minPlayers) {
        const currentState = activeGames.get(gameId);
        if (!currentState?.countdownTimer) {
            try {
                await startCountdown(gameId, uniquePlayers.length);
            }
            catch (e) {
                logger_1.logger.error('Countdown start failed:', e);
            }
        }
    }
    return { tickets: results.tickets, cards: preparedCards.map(c => c.pattern) };
}
function getActiveGames() {
    return activeGames;
}
//# sourceMappingURL=engine.js.map