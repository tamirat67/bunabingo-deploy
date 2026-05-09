import { PrismaClient } from '@prisma/client';
export declare const prisma: PrismaClient<import(".prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
/**
 * Executes a database operation with automatic reconnect on "Connection Closed" errors.
 * Neon serverless databases sleep after inactivity — this handles the reconnect transparently.
 */
export declare function withRetry<T>(operation: () => Promise<T>, retries?: number, delayMs?: number): Promise<T>;
export default prisma;
//# sourceMappingURL=prisma.d.ts.map