import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.user.count({ where: { role: 'AGENT' } });
  console.log('Agents count:', count);
}
main().finally(() => prisma.$disconnect());
