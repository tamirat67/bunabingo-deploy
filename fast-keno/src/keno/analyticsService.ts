import { PrismaClient } from "@prisma/client";

export class AnalyticsService {
  constructor(private prisma: PrismaClient) {}

  async getRecentDrawHistory(limit = 20) {
    return this.prisma.kenoRound.findMany({
      where: { status: "COMPLETED" },
      orderBy: { id: "desc" },
      take: limit,
      select: { roundCode: true, drawnNumbers: true, drawnAt: true },
    });
  }

  async getHotColdNumbers(sampleRounds = 100) {
    const rounds = await this.prisma.kenoRound.findMany({
      where: { status: "COMPLETED" },
      orderBy: { id: "desc" },
      take: sampleRounds,
      select: { drawnNumbers: true },
    });

    const frequency = new Map<number, number>();
    for (let i = 1; i <= 80; i++) frequency.set(i, 0);

    for (const round of rounds) {
      for (const n of round.drawnNumbers) {
        frequency.set(n, (frequency.get(n) ?? 0) + 1);
      }
    }

    const sorted = [...frequency.entries()].sort((a, b) => b[1] - a[1]);
    const hot = sorted.slice(0, 10).map(([n]) => n);
    const cold = [...sorted].sort((a, b) => a[1] - b[1]).slice(0, 10).map(([n]) => n);

    return {
      sampleRounds: rounds.length,
      hotNumbers: hot,
      coldNumbers: cold,
      frequency: Object.fromEntries(frequency),
    };
  }
}
