'use client';
import { getLanguage } from './telegram';

const translations = {
  en: {
    // Brand
    bunaGameZone: 'BUNA GAME ZONE',
    bunaBingo: 'Buna Bingo',

    // Lobby
    comingSoon: 'Coming Soon!',
    spinComingSoonTitle: 'Coming Soon!',
    spinComingSoonSubtitle: 'Stay Tuned! 🚧',
    spinComingSoonMsg: 'Buna Spin Games are currently undergoing major high-performance upgrades. We are preparing grand prize wheels, instant multipliers, and real-time syncing to deliver the ultimate gaming experience!',
    spinComingSoonMsgAlt: 'Buna Spin games are coming with exciting new updates. Grand prizes and fast wins are on the way!',
    backToLobby: 'BACK TO LOBBY',
    depositConfirmedTitle: 'Deposit Confirmed!',
    depositConfirmedMsg: (amount: string, bonus: string) => `Your ${amount} ETB deposit has been confirmed. ${bonus} ETB bonus has been added to your wallet!`,
    spinUnavailable: '☕ Buna Spin games are temporarily under maintenance. Stay tuned!',

    // Cartela Selection
    depositRequired: 'Deposit Required ⚠️',
    emptyBalanceMsg: 'Warning: Your main balance and bonus balance are empty. Please deposit to play.',
    limitReached: 'Limit Reached',
    maxCartelasMsg: 'Maximum 5 cartelas allowed per player.',
    insufficientFunds: (cost: string, bal: string, bonus: string, total: string) =>
      `You need ${cost} ETB to buy these cartelas. Your balance (Main: ${bal} + Bonus: ${bonus}) = ${total} ETB only. Please deposit to continue.`,
    insufficientFundsBuy: (count: number, cost: string, bal: string, bonus: string, total: string) =>
      `You need ${cost} ETB to buy ${count} cartelas. Your balance (Main: ${bal} + Bonus: ${bonus}) = ${total} ETB only. Please deposit to continue.`,
    gameInProgressMsg: 'Game in progress! Buy cartelas for the next game.',
    gameRunningTicketsClosed: 'A game is currently running. Ticket sales have stopped. Wait for the game to finish — the page will open automatically!',
    gameInProgressScreen: 'Game In Progress!',
    waitForGame: 'Please wait for this game to finish.',
    selectAfterGame: 'You can select cartelas when the game is finished.',
    depositBtn: 'DEPOSIT',
    insufTitle: 'Insufficient Balance',

    // Game Page
    bingoClaimTitle: 'Bingo Claim',
    noBingoYetCheck: 'No Bingo yet! Please verify your cartela.',
    noBingoYetContinue: 'No Bingo yet! Keep playing.',
    errorTitle: 'Error',
    refreshBtn: 'Refresh',
    leaveBtn: 'Leave',

    // Wallet
    depositApprovedTitle: 'Deposit Approved!',
    depositApprovedMsg: (amount: string, bonus: string) => `Your ${amount} ETB deposit has been confirmed. ${bonus} ETB bonus gift has been added to your wallet!`,
    useDepositCommand: 'Please use the /deposit command on the Telegram bot.',
    depositTitle: 'Deposit',

    // Roulette
    rouletteCenter: 'BUNA',

    // Modal
    depositModalBtn: 'DEPOSIT',
    okBtn: 'OK',
  },
  am: {
    // Brand
    bunaGameZone: 'ቡና ጌም ዞን',
    bunaBingo: 'ቡና ቢንጎ',

    // Lobby
    comingSoon: 'በቅርቡ ይጠብቁ!',
    spinComingSoonTitle: 'COMING SOON!',
    spinComingSoonSubtitle: 'በቅርቡ ይጠብቁ! 🚧',
    spinComingSoonMsg: 'Buna Spin Games are currently undergoing major high-performance upgrades. We are preparing grand prize wheels, instant multipliers, and real-time syncing to deliver the ultimate gaming experience!',
    spinComingSoonMsgAlt: 'የቡና ስፒን ጨዋታዎች እጅግ ዘመናዊ እና ፈጣን በሆኑ አዳዲስ ዝመናዎች ላይ ይገኛሉ። በቅርቡ በታላላቅ ሽልማቶችና ፈጣን አሸናፊነቶች በደመቀ ሁኔታ እንመለሳለን!',
    backToLobby: 'ወደ ዋናው ገጽ',
    depositConfirmedTitle: 'ተቀማጭ ተረጋግጧል!',
    depositConfirmedMsg: (amount: string, bonus: string) => `የ ${amount} ETB ተቀማጭዎ ተረጋግጧል። በኪስዎ ላይ ${bonus} ETB የቦነስ ስጦታ ተጨምሯል!`,
    spinUnavailable: '☕ ቡና ስፒን ጨዋታዎች ለጊዜው በእድሳት ላይ ናቸው። ዝግጁ ይሁኑ!',

    // Cartela Selection
    depositRequired: 'ተቀማጭ ያድርጉ ⚠️',
    emptyBalanceMsg: 'ማሳሰቢያ: ዋና ሂሳብዎ እና የቦነስ ሂሳብዎ ባዶ ነው። ለመጫወት እባክዎ ተቀማጭ ያድርጉ።',
    limitReached: 'ገደብ ላይ ደርሰዋል',
    maxCartelasMsg: 'ለአንድ ተጫዋች የተፈቀደው ከፍተኛው የካርቴላ ብዛት 5 ነው።',
    insufficientFunds: (cost: string, bal: string, bonus: string, total: string) =>
      `እነዚህን ካርቴላዎች ለመግዛት ${cost} ETB ያስፈልግዎታል። ያሎት ቀሪ ሂሳብ (ዋና: ${bal} + ቦነስ: ${bonus}) = ${total} ETB ብቻ ነው። ለመቀጠል ተቀማጭ ያድርጉ።`,
    insufficientFundsBuy: (count: number, cost: string, bal: string, bonus: string, total: string) =>
      `${count} ካርቴላ ለመግዛት ${cost} ETB ያስፈልግዎታል። ያሎት ቀሪ ሂሳብ (ዋና: ${bal} + ቦነስ: ${bonus}) = ${total} ETB ብቻ ነው። ለመቀጠል ተቀማጭ ያድርጉ።`,
    gameInProgressMsg: 'ጨዋታ በሂደት ላይ ነው! ለሚቀጥለው ጨዋታ ካርቴላ ይግዙ።',
    gameRunningTicketsClosed: 'አሁን ጨዋታ እየተካሄደ ነው። ካርቴላ መሸጥ ቆሟል። ጨዋታው እስኪጠናቀቅ ይጠብቁ — ገጹ በራሱ ይከፈታል!',
    gameInProgressScreen: 'ጨዋታ በሂደት ላይ ነው!',
    waitForGame: 'ጨዋታው እስኪጠናቀቅ ይጠብቁ።',
    selectAfterGame: 'ጨዋታው ሲጠናቀቅ ካርቴላ መምረጥ ይችላሉ።',
    depositBtn: 'ተቀማጭ ያድርጉ',
    insufTitle: 'በቂ ሂሳብ የለም',

    // Game Page
    bingoClaimTitle: 'ቢንጎ ጥያቄ',
    noBingoYetCheck: 'ገና ቢንጎ አልተገኘም! እባክዎ ካርቴላዎን ያረጋግጡ።',
    noBingoYetContinue: 'ገና ቢንጎ አልተገኘም! መጫወትዎን ይቀጥሉ።',
    errorTitle: 'ስህተት',
    refreshBtn: 'አድስ',
    leaveBtn: 'ውጣ',

    // Wallet
    depositApprovedTitle: 'ተቀማጭ ተረጋግጧል!',
    depositApprovedMsg: (amount: string, bonus: string) => `የ ${amount} ETB ተቀማጭዎ ተረጋግጧል። በኪስዎ ላይ ${bonus} ETB የቦነስ ስጦታ ተጨምሯል!`,
    useDepositCommand: 'እባክዎ በቴሌግራም ቦት ላይ የ /deposit ትዕዛዝን ይጠቀሙ።',
    depositTitle: 'ተቀማጭ',

    // Roulette
    rouletteCenter: 'ቡና',

    // Modal
    depositModalBtn: 'ተቀማጭ ያድርጉ',
    okBtn: 'እሺ',
  },
};

export function t<K extends keyof typeof translations.en>(key: K): typeof translations.en[K] {
  const lang = getLanguage() as 'en' | 'am';
  return (translations[lang]?.[key] ?? translations.en[key]) as typeof translations.en[K];
}

export default t;
