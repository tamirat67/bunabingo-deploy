import { PrismaClient } from '@prisma/client';
import { logger } from '../lib/logger';

const prisma = new PrismaClient();

export async function launchWeeklyBlastEvent() {
  try {
    // Check if an event already exists and is open today to avoid duplicates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingOpen = await prisma.weeklyRewardEvent.findFirst({
      where: {
        status: 'OPEN',
        startedAt: { gte: today }
      }
    });

    if (existingOpen) {
      logger.info(`[Weekly Blast] Event is already OPEN for today (ID: ${existingOpen.id})`);
      return;
    }

    // Close any older open events just in case
    await prisma.weeklyRewardEvent.updateMany({
      where: { status: 'OPEN' },
      data: { status: 'CLOSED', closedAt: new Date() }
    });

    // Launch new event
    const newEvent = await prisma.weeklyRewardEvent.create({
      data: {
        status: 'OPEN',
      }
    });

    logger.info(`🎉 [Weekly Blast] New event launched successfully! (ID: ${newEvent.id})`);
  } catch (error) {
    logger.error('❌ [Weekly Blast] Failed to launch event:', error);
  }
}

// Function to auto-close event after 24 hours if not already closed
export async function autoCloseWeeklyBlast() {
  try {
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    const oldEvents = await prisma.weeklyRewardEvent.findMany({
      where: {
        status: 'OPEN',
        startedAt: { lte: yesterday }
      }
    });

    if (oldEvents.length > 0) {
      await prisma.weeklyRewardEvent.updateMany({
        where: { id: { in: oldEvents.map(e => e.id) } },
        data: { status: 'CLOSED', closedAt: new Date() }
      });
      logger.info(`[Weekly Blast] Auto-closed ${oldEvents.length} expired event(s).`);
    }
  } catch (error) {
    logger.error('❌ [Weekly Blast] Failed to auto-close events:', error);
  }
}
