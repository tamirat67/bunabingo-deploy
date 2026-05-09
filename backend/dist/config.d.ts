export declare const config: {
    bot: {
        token: string;
        adminIds: string[];
        miniAppUrl: string;
    };
    server: {
        port: number;
        nodeEnv: string;
        jwtSecret: string;
    };
    pusher: {
        appId: string;
        key: string;
        secret: string;
        cluster: string;
    };
    game: {
        ticketPrice: {
            DEMO: number;
            CASUAL: number;
            STANDARD: number;
            PRO: number;
            JACKPOT: number;
        };
        minPlayers: {
            DEMO: number;
            CASUAL: number;
            STANDARD: number;
            PRO: number;
            JACKPOT: number;
        };
        countdown: Record<number, number>;
        drawIntervalMs: number;
        houseEdgePercent: number;
        totalNumbers: number;
    };
    withdrawal: {
        minAmount: number;
        maxAmount: number;
    };
    payment: {
        receiverName: string;
        receiverPhone: string;
        telebirrPhone: string;
        supportAgent1: string;
        supportAgent2: string;
        supportAdminId: string;
        bunaEngineHost: string;
        bunaEngineKey: string;
    };
};
//# sourceMappingURL=config.d.ts.map