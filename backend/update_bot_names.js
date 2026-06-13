/**
 * update_bot_names.js
 * Assigns Ethiopian names to all house bot users in the DB.
 * Run: node update_bot_names.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ETHIOPIAN_NAMES = [
  'Abebe', 'Kebede', 'Tommy', 'Tesfaye', 'Girma', 'Tadesse', 'Haile',
  'Dawit', 'Bereket', 'Solomon', 'Yonas', 'Fitsum', 'Ermias', 'Mulugeta',
  'Getachew', 'Mekonnen', 'Amanuel', 'Henok', 'Natnael', 'Biniam',
  'Teklay', 'Yohannes', 'Tewodros', 'Feleke', 'Bekele', 'Alemayehu',
  'Getu', 'Degu', 'Bura', 'Tigistu', 'Gadisa', 'Tolosa', 'Dereje',
  'Hussein', 'Abel', 'Challa', 'Gemechu', 'Tilahun', 'Ephrem', 'Surafel',
  'Kidus', 'Robel', 'Eyob', 'Berhane', 'Tsegay', 'Kibrom', 'Hagos',
  'Bisrat', 'Semere', 'Aman', 'Zelalem', 'Matias', 'Mikias', 'Nahom',
  'Samuel', 'Elias', 'Kaleb', 'Abdi', 'Fikru', 'Sirak', 'Leul',
];

async function main() {
  const bots = await prisma.user.findMany({
    where: { isBot: true },
    select: { id: true, firstName: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${bots.length} bot users. Assigning Ethiopian names...`);

  for (let i = 0; i < bots.length; i++) {
    const name = ETHIOPIAN_NAMES[i % ETHIOPIAN_NAMES.length];
    await prisma.user.update({
      where: { id: bots[i].id },
      data: {
        firstName: name,
        telegramUsername: name.toLowerCase() + '_' + (i + 1),
      },
    });
    if ((i + 1) % 10 === 0) console.log(`  Updated ${i + 1}/${bots.length}...`);
  }

  console.log(`✅ Done! All ${bots.length} bots now have Ethiopian names.`);
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
