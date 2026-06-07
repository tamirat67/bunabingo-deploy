import prisma from '../lib/prisma';
import { logger } from '../lib/logger';

export async function logAdminAction(adminId: string, action: string, targetUserId?: string | null, details?: any) {
  try {
    await prisma.adminLog.create({
      data: {
        adminId,
        action,
        targetUserId,
        details: details ? details : null,
      }
    });
  } catch (error) {
    logger.error('[logAdminAction] Error creating admin log:', error);
  }
}
