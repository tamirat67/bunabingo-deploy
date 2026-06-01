import prisma from '../lib/prisma';
import { config } from '../config';
import { logger } from '../lib/logger';

// Default values loaded from config
const DEFAULT_SETTINGS: Record<string, string> = {
  COMPANY_COMMISSION_RATE: '20',
  AGENT_PROFIT_RATE: '10',
  HOUSE_BOT_ENABLED: 'true',
  BONUS_ACTIVE: 'true',
  BONUS_PERCENT: '100',
  BONUS_MIN_DEPOSIT: '50',
};

/**
 * Get a system setting from the database. Falls back to config if not found.
 */
export async function getSystemSetting(key: string): Promise<string> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key },
    });
    if (setting) {
      return setting.value;
    }
  } catch (err) {
    logger.error(`[SettingsService] Failed to fetch setting ${key}:`, err);
  }
  return DEFAULT_SETTINGS[key] || '';
}

/**
 * Get Company Commission Rate (as decimal, e.g. 0.125)
 */
export async function getCompanyCommissionRate(): Promise<number> {
  const rateStr = await getSystemSetting('COMPANY_COMMISSION_RATE');
  const rate = parseFloat(rateStr);
  return isNaN(rate) ? config.game.companyCommissionRate : rate / 100;
}

/**
 * Get Agent Profit Rate (as decimal, e.g. 0.125)
 */
export async function getAgentProfitRate(): Promise<number> {
  const rateStr = await getSystemSetting('AGENT_PROFIT_RATE');
  const rate = parseFloat(rateStr);
  return isNaN(rate) ? config.game.agentProfitRate : rate / 100;
}

export async function getHouseBotEnabled(): Promise<boolean> {
  const enabled = await getSystemSetting('HOUSE_BOT_ENABLED');
  return enabled !== 'false'; // Defaults to true
}

export async function getReceiverPhone(): Promise<string> {
  const phone = await getSystemSetting('PAYMENT_RECEIVER_PHONE');
  return phone || config.payment.receiverPhone;
}

export async function getReceiverName(): Promise<string> {
  const name = await getSystemSetting('PAYMENT_RECEIVER_NAME');
  return name || config.payment.receiverName;
}

export async function getTelebirrPhone(): Promise<string> {
  const phone = await getSystemSetting('PAYMENT_TELEBIRR_PHONE');
  return phone || config.payment.telebirrPhone;
}

export async function getDepositBonusActive(): Promise<boolean> {
  const active = await getSystemSetting('BONUS_ACTIVE');
  return active === 'true';
}

export async function getDepositBonusPercent(): Promise<number> {
  const val = await getSystemSetting('BONUS_PERCENT');
  const percent = parseFloat(val);
  return isNaN(percent) ? 100 : percent;
}

export async function getDepositBonusMinDeposit(): Promise<number> {
  const val = await getSystemSetting('BONUS_MIN_DEPOSIT');
  const minDep = parseFloat(val);
  return isNaN(minDep) ? 50 : minDep;
}

export async function getDepositBonusExpiry(): Promise<Date | null> {
  const val = await getSystemSetting('BONUS_EXPIRY');
  if (!val) return null;
  const date = new Date(val);
  return isNaN(date.getTime()) ? null : date;
}

export async function isDepositBonusEligible(amount: number): Promise<{ active: boolean; percentage: number }> {
  const active = await getDepositBonusActive();
  if (!active) {
    return { active: false, percentage: 0 };
  }
  const expiry = await getDepositBonusExpiry();
  if (expiry && new Date() > expiry) {
    return { active: false, percentage: 0 };
  }
  const minDeposit = await getDepositBonusMinDeposit();
  if (amount < minDeposit) {
    return { active: true, percentage: 0 };
  }
  const percent = await getDepositBonusPercent();
  return { active: true, percentage: percent };
}


/**
 * Set a system setting in the database.
 */
export async function setSystemSetting(key: string, value: string): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value, updatedAt: new Date() },
  });
  logger.info(`[SettingsService] System setting updated: ${key} = ${value}`);
}
