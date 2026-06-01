import prisma from '../src/lib/prisma';

async function main() {
  console.log("=== SYSTEM SETTINGS ===");
  const settings = await prisma.systemSetting.findMany();
  console.log(JSON.stringify(settings, null, 2));

  console.log("\n=== AGENT PRE-DEPOSIT WALLETS ===");
  const wallets = await prisma.agentPreDepositWallet.findMany({
    include: {
      agent: {
        select: {
          firstName: true,
          role: true,
          telegramUsername: true
        }
      }
    }
  });
  console.log(JSON.stringify(wallets, null, 2));
}

main()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
