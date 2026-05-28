import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkAndSetBonus() {
  const active = await prisma.systemSetting.findUnique({ where: { key: 'BONUS_ACTIVE' } });
  const percent = await prisma.systemSetting.findUnique({ where: { key: 'BONUS_PERCENT' } });
  const minDep = await prisma.systemSetting.findUnique({ where: { key: 'BONUS_MIN_DEPOSIT' } });

  console.log('Current Settings:');
  console.log('BONUS_ACTIVE:', active?.value);
  console.log('BONUS_PERCENT:', percent?.value);
  console.log('BONUS_MIN_DEPOSIT:', minDep?.value);

  await prisma.systemSetting.upsert({
    where: { key: 'BONUS_ACTIVE' },
    create: { key: 'BONUS_ACTIVE', value: 'true' },
    update: { value: 'true' }
  });
  await prisma.systemSetting.upsert({
    where: { key: 'BONUS_PERCENT' },
    create: { key: 'BONUS_PERCENT', value: '100' },
    update: { value: '100' }
  });
  await prisma.systemSetting.upsert({
    where: { key: 'BONUS_MIN_DEPOSIT' },
    create: { key: 'BONUS_MIN_DEPOSIT', value: '50' },
    update: { value: '50' }
  });

  console.log('Successfully set: BONUS_ACTIVE=true, BONUS_PERCENT=100, BONUS_MIN_DEPOSIT=50');
  process.exit(0);
}

checkAndSetBonus();
