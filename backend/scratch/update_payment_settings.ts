import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const settings = [
    { key: 'PAYMENT_RECEIVER_PHONE', value: '251929922421' },
    { key: 'PAYMENT_TELEBIRR_PHONE', value: '251997688294' },
    { key: 'PAYMENT_RECEIVER_NAME', value: 'SULTAN MEBRAHETOM' }
  ];

  console.log('Updating database system settings...');

  for (const s of settings) {
    const updated = await prisma.systemSetting.upsert({
      where: { key: s.key },
      create: { key: s.key, value: s.value },
      update: { value: s.value, updatedAt: new Date() }
    });
    console.log(`✅ Set ${updated.key} = "${updated.value}"`);
  }

  console.log('Database settings update complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
