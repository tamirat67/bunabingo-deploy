import { Request, Response, NextFunction } from 'express';
import { getUserByTelegramId, getUserByTelegramIdBigInt, findOrCreateUser } from '../services/user.service';
import crypto from 'crypto';
import { logger } from '../lib/logger';
import jwt from 'jsonwebtoken';
import { config } from '../config';

/**
 * Validates Telegram Mini App initData OR JWT Token and attaches user to req
 */
export async function telegramAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const initData = req.headers['x-telegram-init-data'] as string;
    const authHeader = req.headers['authorization'];
    const isDev = process.env.NODE_ENV !== 'production';

    // ─── 1. Check for JWT (Web Login) ───────────────────────────
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, config.server.jwtSecret) as any;
        // Use BigInt directly to avoid precision loss for large Telegram IDs (>2^31)
        const user = await getUserByTelegramIdBigInt(BigInt(decoded.telegramId));
        if (user) {
          if (user.status === 'BANNED') return res.status(403).json({ error: 'Account banned' });
          (req as any).user = user;
          return next();
        } else {
          logger.warn(`[Auth] JWT valid but user not found for telegramId: ${decoded.telegramId}`);
        }
      } catch (err) {
        logger.warn('[Auth] Invalid JWT token provided');
      }
    }

    // ─── 2. Check for Telegram InitData ─────────────────────────

    // In dev mode with no initData: attach a mock test user so the browser works
    if (!initData) {
      if (isDev) {
        const devUser = await findOrCreateUser({
          id: 999999999,
          username: 'dev_tester',
          first_name: 'Dev',
          last_name: 'Tester',
        });
        (req as any).user = devUser;
        return next();
      }
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }

    // Parse and validate initData
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return res.status(401).json({ error: 'Invalid auth data' });

    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(process.env.BOT_TOKEN!)
      .digest();

    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (expectedHash !== hash) {
      logger.warn(`[Auth] Hash mismatch! Possible BOT_TOKEN mismatch on server.`);
      logger.warn(`[Auth] Expected: ${expectedHash.slice(0,10)}... Got: ${hash?.slice(0,10)}...`);
      return res.status(401).json({ error: 'Invalid Telegram signature. Check BOT_TOKEN on server.' });
    }

    const userParam = params.get('user');
    if (!userParam) return res.status(401).json({ error: 'No user data' });

    const tgUser = JSON.parse(userParam);
    const startParam = params.get('start_param');

    // Look for user, but DO NOT CREATE
    const user = await getUserByTelegramId(tgUser.id);

    if (user) {
      if (user.status === 'BANNED') return res.status(403).json({ error: 'Account banned' });
      (req as any).user = user;
    } else {
      // Not registered - attach tgUser so /auth/register can use it
      (req as any).tgUser = { ...tgUser, startParam };
    }
    
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Admin-only middleware — runs after telegramAuthMiddleware
 */
export function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user || (user.role !== 'ADMIN' && !user.isAdmin)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * Agent middleware — allows Agents and Admins to access agent portals
 */
export function agentMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user || (user.role !== 'AGENT' && user.role !== 'STAFF' && user.role !== 'ADMIN' && !user.isAdmin)) {
    return res.status(403).json({ error: 'Agent access required' });
  }
  next();
}

/**
 * Staff middleware — allows Staff and Admins to access staff portals
 */
export function staffMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user || (user.role !== 'STAFF' && user.role !== 'ADMIN' && !user.isAdmin)) {
    return res.status(403).json({ error: 'Staff access required' });
  }
  next();
}
