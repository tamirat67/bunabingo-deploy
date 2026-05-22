const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const adminId = '6836036070';
  let user = await prisma.user.findFirst({ where: { telegramId: adminId } });
  
  if (!user) {
    user = await prisma.user.findFirst({ where: { telegramUsername: 'Luel1616' } });
  }

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        role: 'ADMIN',
        depositPhones: [{ name: 'Luel G/libanos', phone: '+251969455111', last4: '5111' }]
      }
    });
    console.log('Successfully updated Luel in the database with the new deposit phone number!');
  } else {
    console.log('Luel not found in DB. He needs to start the bot first.');
  }
}

run()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); });
