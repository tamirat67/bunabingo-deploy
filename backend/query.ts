import prisma from './src/lib/prisma';
async function main() {
  const u = await prisma.user.findUnique({ where: { telegramId: '5310030963' } });
  console.log(u);
}
main().finally(() => prisma.$disconnect());
