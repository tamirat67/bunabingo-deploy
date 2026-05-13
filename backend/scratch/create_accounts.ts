
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = [
    { telegram_id: BigInt('8263717692'), username: 'bunabingosupport', role: 'agent', is_admin: false, ref: 'SUPPORT1' },
    { telegram_id: BigInt('5327151800'), username: 'sisay_2121', role: 'agent', is_admin: false, ref: 'SISAY2121' },
    { telegram_id: BigInt('5310030963'), username: 'tanga_dreams', role: 'admin', is_admin: true, ref: 'TANGA' }
  ];

  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { telegram_id: u.telegram_id } });
    if (existing) {
      console.log(`Updating user ${u.username} (${u.telegram_id})...`);
      await prisma.user.update({
        where: { telegram_id: u.telegram_id },
        data: { role: u.role, username: u.username, is_admin: u.is_admin }
      });
    } else {
      console.log(`Creating user ${u.username} (${u.telegram_id})...`);
      await prisma.user.create({
        data: {
          telegram_id: u.telegram_id,
          username: u.username,
          role: u.role,
          is_admin: u.is_admin,
          referral_code: u.ref,
          wallets: {
            create: { balance: 0 }
          }
        }
      });
    }
  }
  console.log('All accounts created/updated successfully with roles and is_admin status.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
