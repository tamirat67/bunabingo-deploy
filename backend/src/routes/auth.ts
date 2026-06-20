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
    // We use telegramUsername or telegramId as the "username" for login
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { telegramUsername: username },
          ...(username.trim() !== '' && !isNaN(Number(username)) ? [{ telegramId: BigInt(username) }] : [])
        ]
      },
      include: { wallet: true }
    });

    if (!user || !user.passwordHash) {
      logger.warn(`[Auth] Failed login attempt for: ${username} (User not found or no password set)`);
      return res.status(401).json({ error: 'Invalid credentials or access denied' });
    }

    // Verify role
    if (user.role !== 'ADMIN' && user.role !== 'AGENT' && user.role !== 'STAFF' && !user.isAdmin) {
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
  if (user.role !== 'ADMIN' && user.role !== 'AGENT' && user.role !== 'STAFF' && !user.isAdmin) {
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

/**
 * Helper: Verify admin JWT from Authorization header.
 * Used by routes in the public /api/auth router that need admin-only access.
 */
async function verifyAdminJwt(req: Request): Promise<{ id: string; role: string; isAdmin: boolean } | null> {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.server.jwtSecret) as any;
    if (decoded.role !== 'ADMIN' && !decoded.isAdmin) return null;
    return { id: decoded.id, role: decoded.role, isAdmin: decoded.isAdmin };
  } catch {
    return null;
  }
}

/**
 * POST /api/auth/create-staff
 * Admin-only: Create a portal-only cashier/staff/agent account with username + password.
 * No Telegram required.
 */
router.post('/create-staff', async (req: Request, res: Response) => {
  const admin = await verifyAdminJwt(req);

  // Must be called with a valid JWT from an ADMIN
  if (!admin || (admin.role !== 'ADMIN' && !admin.isAdmin)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { username, password, role = 'STAFF', firstName } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const allowedRoles = ['STAFF', 'AGENT', 'ADMIN'];
  if (!allowedRoles.includes(role.toUpperCase())) {
    return res.status(400).json({ error: `Role must be one of: ${allowedRoles.join(', ')}` });
  }

  try {
    // Check username is not taken
    const existing = await prisma.user.findFirst({
      where: { telegramUsername: username }
    });
    if (existing) {
      return res.status(409).json({ error: `Username "${username}" is already taken` });
    }

    // Synthetic negative telegramId so we never collide with real Telegram users
    const syntheticTelegramId = BigInt(-1) * BigInt(Date.now());

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        telegramId: syntheticTelegramId,
        telegramUsername: username,
        firstName: firstName || username,
        role: role.toUpperCase() as any,
        passwordHash: hashedPassword,
        wallet: { create: { balance: 0 } }
      }
    });

    logger.info(`[Auth] Admin ${admin.id} created portal staff user: ${username} (${role})`);

    res.json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.telegramUsername,
        firstName: newUser.firstName,
        role: newUser.role
      }
    });
  } catch (err: any) {
    logger.error('[Auth] create-staff error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/**
 * POST /api/auth/reset-password
 * Admin-only: Reset another user's password by their ID.
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  const admin = await verifyAdminJwt(req);
  if (!admin || (admin.role !== 'ADMIN' && !admin.isAdmin)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { userId, newPassword } = req.body;
  if (!userId || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'userId and newPassword (min 6 chars) are required' });
  }

  try {
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashed }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
