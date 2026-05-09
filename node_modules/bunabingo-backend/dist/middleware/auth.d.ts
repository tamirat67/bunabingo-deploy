import { Request, Response, NextFunction } from 'express';
/**
 * Validates Telegram Mini App initData and attaches user to req
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export declare function telegramAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
/**
 * Admin-only middleware — runs after telegramAuthMiddleware
 */
export declare function adminMiddleware(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>>;
//# sourceMappingURL=auth.d.ts.map