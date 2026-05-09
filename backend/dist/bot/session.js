"use strict";
/**
 * In-memory session store for multi-step bot conversations.
 * Each user can have one active session at a time.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setSession = setSession;
exports.getSession = getSession;
exports.clearSession = clearSession;
const sessions = new Map();
function setSession(telegramId, session) {
    sessions.set(telegramId, session);
}
function getSession(telegramId) {
    return sessions.get(telegramId);
}
function clearSession(telegramId) {
    sessions.delete(telegramId);
}
//# sourceMappingURL=session.js.map