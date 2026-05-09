"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerAdminEvent = exports.triggerUserEvent = exports.triggerGameEvent = exports.pusher = void 0;
const pusher_1 = __importDefault(require("pusher"));
const config_1 = require("../config");
exports.pusher = new pusher_1.default({
    appId: config_1.config.pusher.appId,
    key: config_1.config.pusher.key,
    secret: config_1.config.pusher.secret,
    cluster: config_1.config.pusher.cluster,
    useTLS: true,
});
const triggerGameEvent = async (gameId, event, data) => {
    try {
        await exports.pusher.trigger(`game-${gameId}`, event, data);
    }
    catch (err) {
        console.error('[Pusher] Failed to trigger event:', err);
    }
};
exports.triggerGameEvent = triggerGameEvent;
const triggerUserEvent = async (userId, event, data) => {
    try {
        await exports.pusher.trigger(`user-${userId}`, event, data);
    }
    catch (err) {
        console.error('[Pusher] Failed to trigger user event:', err);
    }
};
exports.triggerUserEvent = triggerUserEvent;
const triggerAdminEvent = async (event, data) => {
    try {
        await exports.pusher.trigger('admin-channel', event, data);
    }
    catch (err) {
        console.error('[Pusher] Failed to trigger admin event:', err);
    }
};
exports.triggerAdminEvent = triggerAdminEvent;
//# sourceMappingURL=pusher.js.map