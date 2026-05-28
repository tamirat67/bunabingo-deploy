const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const parseDate = (val) => (val && val !== 'null' && val !== 'undefined' && val !== '' ? new Date(val) : null);
    
    const scheduledAt = '';
    const expiresAt = '';
    const activeVal = true;
    
    console.log("Attempting to create promotion...");
    const promotion = await prisma.promotion.create({
      data: {
        title: "Test",
        message: "Test message",
        type: 'announcement',
        imageUrl: null,
        isActive: activeVal,
        scheduledAt: parseDate(scheduledAt),
        expiresAt: parseDate(expiresAt),
        sentAt: activeVal ? new Date() : null,
      },
    });
    console.log("Success:", promotion);
  } catch (err) {
    console.error("Error creating promotion:", err);
  } finally {
    await prisma.$disconnect();
  }
}
test();
