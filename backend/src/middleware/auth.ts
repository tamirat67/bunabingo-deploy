import { Request, Response, NextFunction } from 'express';
import { getUserByTelegramId, findOrCreateUser } from '../services/user.service';
import crypto from 'crypto';

/**
 * Validates Telegram Mini App initData and attaches user to req
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export async function telegramAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const initData = req.headers['x-telegram-init-data'] as string;

    if (!initData) {
      return res.status(401).json({ error: 'Missing Telegram auth data' });
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
      return res.status(401).json({ error: 'Invalid Telegram signature' });
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
  if (!user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
