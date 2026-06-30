import { PrismaClient } from "@prisma/client";

// Standard Next.js-safe Prisma singleton (prevents exhausting DB connections
// on hot reload in dev). If your existing backend already exports a prisma
// singleton, delete this file and import that one instead everywhere below.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
