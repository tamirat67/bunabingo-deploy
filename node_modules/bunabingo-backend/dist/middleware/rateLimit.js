"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinGameLimiter = exports.withdrawLimiter = exports.depositLimiter = exports.apiLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 9999, // Practically unlimited for testing
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please slow down.' },
});
exports.depositLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: { error: 'Too many deposit requests. Try again in an hour.' },
});
exports.withdrawLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: { error: 'Too many withdrawal requests. Try again in an hour.' },
});
exports.joinGameLimiter = (0, express_rate_limit_1.default)({
    windowMs: 5 * 1000, // 5 seconds
    max: 20, // 20 times
    message: { error: 'Please wait a moment before joining again.' },
});
//# sourceMappingURL=rateLimit.js.map