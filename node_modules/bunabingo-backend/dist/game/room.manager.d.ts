export declare function initializeRooms(): Promise<void>;
export declare function getRooms(): Promise<({
    games: ({
        tickets: {
            id: string;
            userId: string;
            gameId: string;
            cartelaId: number;
            card: import("@prisma/client/runtime/library").JsonValue | null;
            markedNumbers: number[];
            isWinner: boolean;
            purchasedAt: Date;
        }[];
    } & {
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        roomId: string;
        totalPrize: import("@prisma/client/runtime/library").Decimal;
        houseEdge: import("@prisma/client/runtime/library").Decimal;
        calledNumbers: number[];
        countdownSeconds: number | null;
        startedAt: Date | null;
        finishedAt: Date | null;
        cancelledAt: Date | null;
        cancelReason: string | null;
    })[];
} & {
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    type: string;
    ticketPrice: import("@prisma/client/runtime/library").Decimal;
    minPlayers: number;
    maxPlayers: number;
    currentPlayers: number;
    isActive: boolean;
})[]>;
export declare function getRoomWithActiveGame(roomType: string): Promise<{
    games: ({
        tickets: {
            userId: string;
        }[];
    } & {
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        roomId: string;
        totalPrize: import("@prisma/client/runtime/library").Decimal;
        houseEdge: import("@prisma/client/runtime/library").Decimal;
        calledNumbers: number[];
        countdownSeconds: number | null;
        startedAt: Date | null;
        finishedAt: Date | null;
        cancelledAt: Date | null;
        cancelReason: string | null;
    })[];
} & {
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    type: string;
    ticketPrice: import("@prisma/client/runtime/library").Decimal;
    minPlayers: number;
    maxPlayers: number;
    currentPlayers: number;
    isActive: boolean;
}>;
//# sourceMappingURL=room.manager.d.ts.map