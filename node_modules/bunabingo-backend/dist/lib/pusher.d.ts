import Pusher from 'pusher';
export declare const pusher: Pusher;
export declare const triggerGameEvent: (gameId: string, event: string, data: unknown) => Promise<void>;
export declare const triggerUserEvent: (userId: string, event: string, data: unknown) => Promise<void>;
export declare const triggerAdminEvent: (event: string, data: unknown) => Promise<void>;
//# sourceMappingURL=pusher.d.ts.map