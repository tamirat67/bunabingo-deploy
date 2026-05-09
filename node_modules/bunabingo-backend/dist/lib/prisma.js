"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.withRetry = withRetry;
const client_1 = require("@prisma/client");
const globalForPrisma = globalThis;
const createPrismaClient = () => new client_1.PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});
exports.prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== 'production')
    globalForPrisma.prisma = exports.prisma;
/**
 * Executes a database operation with automatic reconnect on "Connection Closed" errors.
 * Neon serverless databases sleep after inactivity — this handles the reconnect transparently.
 */
async function withRetry(operation, retries = 3, delayMs = 500) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await operation();
        }
        catch (err) {
            const isClosedError = err?.message?.includes('Closed') ||
                err?.message?.includes('Connection') ||
                err?.code === 'P1001' ||
                err?.code === 'P1017';
            if (isClosedError && attempt < retries) {
                console.warn(`[DB] Connection dropped (attempt ${attempt}/${retries}), reconnecting...`);
                try {
                    await exports.prisma.$disconnect();
                    await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
                    await exports.prisma.$connect();
                }
                catch (_) { }
                continue;
            }
            throw err;
        }
    }
    throw new Error('Max retries exceeded');
}
exports.default = exports.prisma;
//# sourceMappingURL=prisma.js.map