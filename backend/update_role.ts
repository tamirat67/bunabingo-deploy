import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.update({
    where: { id: 'd1d93520-0c1a-4403-bf0c-f2f162a1dd36' },
    data: { role: 'ADMIN' },
  });
  console.log('User updated:', user.firstName, user.role);
}
main().catch(console.error).finally(() => prisma.$disconnect());
