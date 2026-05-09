"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeRooms = initializeRooms;
exports.getRooms = getRooms;
exports.getRoomWithActiveGame = getRoomWithActiveGame;
const prisma_1 = __importDefault(require("../lib/prisma"));
const config_1 = require("../config");
const engine_1 = require("../game/engine");
const RoomType = {
    DEMO: 'DEMO',
    CASUAL: 'CASUAL',
    STANDARD: 'STANDARD',
    PRO: 'PRO',
    JACKPOT: 'JACKPOT',
};
async function initializeRooms() {
    const rooms = [
        {
            type: RoomType.DEMO,
            ticketPrice: config_1.config.game.ticketPrice.DEMO ?? 0,
            minPlayers: config_1.config.game.minPlayers.DEMO ?? 1,
            maxPlayers: 100,
        },
        {
            type: RoomType.CASUAL,
            ticketPrice: config_1.config.game.ticketPrice.CASUAL,
            minPlayers: config_1.config.game.minPlayers.CASUAL,
            maxPlayers: 100,
        },
        {
            type: RoomType.STANDARD,
            ticketPrice: config_1.config.game.ticketPrice.STANDARD,
            minPlayers: config_1.config.game.minPlayers.STANDARD,
            maxPlayers: 200,
        },
        {
            type: RoomType.PRO,
            ticketPrice: config_1.config.game.ticketPrice.PRO,
            minPlayers: config_1.config.game.minPlayers.PRO,
            maxPlayers: 300,
        },
        {
            type: RoomType.JACKPOT,
            ticketPrice: config_1.config.game.ticketPrice.JACKPOT,
            minPlayers: config_1.config.game.minPlayers.JACKPOT,
            maxPlayers: 500,
        },
    ];
    for (const roomData of rooms) {
        let room = await prisma_1.default.room.findFirst({ where: { type: roomData.type } });
        if (!room) {
            room = await prisma_1.default.room.create({ data: roomData });
        }
        else {
            room = await prisma_1.default.room.update({
                where: { id: room.id },
                data: {
                    ticketPrice: roomData.ticketPrice,
                    minPlayers: roomData.minPlayers,
                    isActive: true,
                },
            });
        }
        await (0, engine_1.createWaitingGame)(room.id);
    }
}
async function getRooms() {
    return prisma_1.default.room.findMany({
        where: { isActive: true },
        include: {
            games: {
                where: { status: { in: ['WAITING', 'COUNTDOWN'] } },
                include: { tickets: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
            },
        },
    });
}
async function getRoomWithActiveGame(roomType) {
    return prisma_1.default.room.findFirst({
        where: { type: roomType, isActive: true },
        include: {
            games: {
                where: { status: { in: ['WAITING', 'COUNTDOWN'] } },
                include: { tickets: { select: { userId: true } } },
                orderBy: { createdAt: 'desc' },
                take: 1,
            },
        },
    });
}
//# sourceMappingURL=room.manager.js.map