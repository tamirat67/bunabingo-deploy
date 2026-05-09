import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const createPrismaClient = () => new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Executes a database operation with automatic reconnect on "Connection Closed" errors.
 * Neon serverless databases sleep after inactivity — this handles the reconnect transparently.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  retries = 3,
  delayMs = 500
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (err: any) {
      const isClosedError =
        err?.message?.includes('Closed') ||
        err?.message?.includes('Connection') ||
        err?.code === 'P1001' ||
        err?.code === 'P1017';

      if (isClosedError && attempt < retries) {
        console.warn(`[DB] Connection dropped (attempt ${attempt}/${retries}), reconnecting...`);
        try {
          await prisma.$disconnect();
          await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
          await prisma.$connect();
        } catch (_) {}
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}

export default prisma;
