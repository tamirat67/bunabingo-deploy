import { BingoCard } from './card.generator';
interface ActiveGame {
    gameId: string;
    roomType: string;
    drawnNumbers: number[];
    drawInterval?: NodeJS.Timeout;
    countdownTimer?: NodeJS.Timeout;
    numberPool: number[];
}
export declare function startCountdown(gameId: string, playerCount: number): Promise<void>;
export declare function cancelGame(gameId: string, reason: string): Promise<void>;
export declare function createWaitingGame(roomId: string): Promise<string>;
export declare function joinGame(userId: string, gameId: string, cardIds?: number[]): Promise<{
    tickets: any[];
    cards: BingoCard[];
}>;
export declare function getActiveGames(): Map<string, ActiveGame>;
export {};
//# sourceMappingURL=engine.d.ts.map