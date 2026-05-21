import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const ETHIOPIAN_FIRST_NAMES = [
  'Abebe', 'Abel', 'Alem', 'Amha', 'Amsalu', 'Aschalew', 'Ashenafi', 'Ayenew',
  'Bekele', 'Belay', 'Bereket', 'Berhanu', 'Biniam', 'Biruk', 'Chala', 'Dagmawi',
  'Dawit', 'Dereje', 'Desalegn', 'Efrem', 'Elias', 'Endalkachew', 'Ephrem',
  'Ermias', 'Esayas', 'Eskinder', 'Eyob', 'Fasil', 'Fikre', 'Fitsum', 'Gashaw',
  'Getachew', 'Girma', 'Habtamu', 'Hagos', 'Hailu', 'Henok', 'Kaleb', 'Kassahun',
  'Kebede', 'Kidane', 'Kiros', 'Lema', 'Mamo', 'Mekonnen', 'Melaku', 'Meles',
  'Mesfin', 'Mikias', 'Mulugeta', 'Nahom', 'Nardos', 'Natnael', 'Nigatu', 'Paulos',
  'Robel', 'Samuel', 'Selam', 'Sisay', 'Solomon', 'Tadesse', 'Tamirat', 'Tariku',
  'Tassew', 'Tefera', 'Tekalign', 'Temesgen', 'Tesfaye', 'Teshale', 'Tewodros',
  'Tilahun', 'Wondimu', 'Wosen', 'Yared', 'Yemane', 'Yigzaw', 'Yilma', 'Yohannes',
  'Yonas', 'Yosef', 'Zekarias', 'Zelalem', 'Zemenu', 'Zerihun'
];

const ETHIOPIAN_LAST_NAMES = [
  'Alemu', 'Ali', 'Assefa', 'Ayana', 'Bekele', 'Belay', 'Bogale', 'Chane',
  'Demisse', 'Desta', 'Feleke', 'Gebre', 'Gelana', 'Getahun', 'Girma', 'Hailu',
  'Hassan', 'Ibrahim', 'Kassaye', 'Kebede', 'Lema', 'Mamo', 'Mengistu', 'Merga',
  'Nigussie', 'Shiferaw', 'Tadesse', 'Tafesse', 'Tekle', 'Teshome', 'Tilahun',
  'Woldemariam', 'Yimer', 'Yohannes', 'Zewde'
];

async function generateBots() {
  console.log('Generating 100 house bots...');
  
  let createdCount = 0;
  for (let i = 0; i < 100; i++) {
    const firstName = ETHIOPIAN_FIRST_NAMES[Math.floor(Math.random() * ETHIOPIAN_FIRST_NAMES.length)];
    const lastName = ETHIOPIAN_LAST_NAMES[Math.floor(Math.random() * ETHIOPIAN_LAST_NAMES.length)];
    const telegramUsername = `${firstName.toLowerCase()}_${Math.floor(Math.random() * 9999)}`;
    const telegramId = BigInt(Math.floor(Math.random() * 9000000000) + 1000000000); // 10 digit random id
    
    try {
      const user = await prisma.user.create({
        data: {
          telegramId,
          telegramUsername,
          firstName,
          lastName,
          isBot: true,
          role: 'PLAYER'
        }
      });
      
      await prisma.wallet.create({
        data: {
          userId: user.id,
          balance: 0,
        }
      });
      createdCount++;
    } catch (e) {
      console.error(`Failed to create bot ${telegramUsername}:`, e);
    }
  }

  // Ensure SystemWallet exists
  try {
    await prisma.systemWallet.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, balance: 0.0 }
    });
  } catch (e) {
    console.log("SystemWallet exists or failed to create");
  }

  console.log(`Successfully created ${createdCount} bots!`);
}

generateBots().catch(console.error).finally(() => prisma.$disconnect());
