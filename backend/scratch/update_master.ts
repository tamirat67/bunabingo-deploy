const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const newMasterId = 6836036070n;
  
  console.log('Upserting new master admin...');
  const defaultAgent = await prisma.user.upsert({
    where: { telegramId: newMasterId },
    create: {
      telegramId: newMasterId,
      telegramUsername: 'Luel1616',
      firstName: 'Buna Bingo Support',
      role: 'AGENT',
      isAdmin: true,
      status: 'ACTIVE',
      referralCode: 'AG-VL7MV',
    },
    update: {
      role: 'AGENT',
      isAdmin: true,
      telegramUsername: 'Luel1616',
      firstName: 'Buna Bingo Support',
      referralCode: 'AG-VL7MV',
    }
  });

  console.log('Updated new master agent:', defaultAgent);

  await prisma.agentPreDepositWallet.upsert({
    where: { agentId: defaultAgent.id },
    create: { agentId: defaultAgent.id, balance: 100000, totalRecharged: 100000 },
    update: {}
  });

  console.log('Agent predeposit wallet ensured.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
