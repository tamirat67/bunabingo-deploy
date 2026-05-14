import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { config } from '../config';
import { logger } from '../lib/logger';

const router = Router();

/**
 * POST /api/auth/login
 * Standard username (telegramId) and password login for Admins/Agents
 */
router.post('/login', async (req: Request, res: Response) => {
  let { username, password } = req.body;
  if (username && username.startsWith('@')) {
    username = username.substring(1);
  }

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    // We use telegramId as the "username" for login
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { telegramUsername: username },
          { telegramId: !isNaN(Number(username)) ? BigInt(username) : undefined }
        ]
      },
      include: { wallet: true }
    });

    if (!user || !user.passwordHash) {
      logger.warn(`[Auth] Failed login attempt for: ${username} (User not found or no password set)`);
      return res.status(401).json({ error: 'Invalid credentials or access denied' });
    }

    // Verify role
    if (user.role !== 'ADMIN' && user.role !== 'AGENT' && !user.isAdmin) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      logger.warn(`[Auth] Invalid password for user: ${username}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { 
        id: user.id, 
        telegramId: user.telegramId.toString(),
        role: user.role,
        isAdmin: user.isAdmin 
      },
      config.server.jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        role: user.role,
        isAdmin: user.isAdmin,
        telegramId: user.telegramId.toString()
      }
    });

  } catch (err) {
    logger.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

/**
 * POST /api/auth/setup-password
 * Allows an admin (verified by Telegram initData) to set their web password
 */
router.post('/setup-password', async (req: Request, res: Response) => {
  const { password } = req.body;
  const user = (req as any).user;

  if (!user) return res.status(401).json({ error: 'Telegram authentication required' });
  if (user.role !== 'ADMIN' && user.role !== 'AGENT' && !user.isAdmin) {
    return res.status(403).json({ error: 'Only staff can set passwords' });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashedPassword }
    });

    res.json({ success: true, message: 'Password set successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to set password' });
  }
});

export default router;
