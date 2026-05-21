import { shouldHouseWinThisGame, recordCycleResult } from '../src/services/houseBot.service';

// Standard simulation of the logic to prove the win quota mathematically
function simulateRngQuota(iterations: number, cycleLength = 50, quota = 30) {
  let totalGames = 0;
  let houseWins = 0;
  let cycleGames = 0;
  let cycleHouseWins = 0;

  for (let i = 0; i < iterations; i++) {
    if (cycleGames >= cycleLength) {
      cycleGames = 0;
      cycleHouseWins = 0;
    }

    const gamesLeft = cycleLength - cycleGames;
    const houseWinsLeft = quota - cycleHouseWins;

    let houseWon = false;
    if (houseWinsLeft >= gamesLeft) {
      houseWon = true;
    } else if (houseWinsLeft <= 0) {
      houseWon = false;
    } else {
      const probability = houseWinsLeft / gamesLeft;
      houseWon = Math.random() < probability;
    }

    if (houseWon) {
      houseWins++;
      cycleHouseWins++;
    }
    totalGames++;
    cycleGames++;
  }

  const winPercentage = (houseWins / totalGames) * 100;
  console.log(`Simulation Results over ${iterations} games:`);
  console.log(`- Total Games: ${totalGames}`);
  console.log(`- House Wins: ${houseWins} (${winPercentage.toFixed(2)}%)`);
  console.log(`- Expected Quota: ${quota}/${cycleLength} (${((quota / cycleLength) * 100).toFixed(2)}%)`);
  return winPercentage;
}

console.log('--- RUNNING WIN QUOTA SIMULATION ---');
simulateRngQuota(1000);
simulateRngQuota(10000);
console.log('------------------------------------');
