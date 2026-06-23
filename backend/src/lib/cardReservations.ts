/**
 * cardReservations.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Lightweight in-memory reservation store for pre-purchase card selections.
 *
 * WHY THIS EXISTS
 * When Player A clicks a card on the selection page but hasn't pressed BUY yet,
 * that selection only exists in their browser. Player B sees the card as free.
 * This module broadcasts those "pending selections" so every connected player
 * sees the card as occupied — identical to bot-owned or purchased cards.
 *
 * LIFECYCLE (in order of priority)
 * 1. Game starts (runGame)      → clearGameReservations(gameId)  ← PRIMARY cleanup
 * 2. Player buys tickets        → releaseCards(gameId, cardIds, userId)
 * 3. Player deselects / leaves  → frontend emits card-select []  → releaseCards
 * 4. 2-minute TTL               → safety net for silent disconnects ONLY
 *
 * Reservations are keyed by the game UUID, so they NEVER carry over to the next
 * game — each game gets a fresh UUID and a completely empty reservation map.
 */

import { logger } from './logger';

/** TTL: 2 minutes. Only fires if player closes app without deselecting. */
const RESERVATION_TTL_MS = 2 * 60 * 1000;

/** Cleanup interval: run every 30 seconds to prune expired entries. */
const CLEANUP_INTERVAL_MS = 30 * 1000;

interface Reservation {
  userId: string;
  roomType: string;
  expiresAt: number;
}

/**
 * gameId → (cardId → Reservation)
 * Each game has its own isolated map.
 */
const store = new Map<string, Map<number, Reservation>>();

/** Get or create the inner map for a game. */
function getGameMap(gameId: string): Map<number, Reservation> {
  if (!store.has(gameId)) {
    store.set(gameId, new Map());
  }
  return store.get(gameId)!;
}

/**
 * Reserve a set of cardIds for a user in a specific game.
 * - Clears any previous reservations by this user in this game first.
 * - If cardIds is empty, this acts as a full release for that user.
 */
export function reserveCards(
  gameId: string,
  cardIds: number[],
  userId: string,
  roomType: string,
): void {
  const gameMap = getGameMap(gameId);
  const expiresAt = Date.now() + RESERVATION_TTL_MS;

  // Clear any existing reservations this user holds in this game
  for (const [cardId, res] of gameMap.entries()) {
    if (res.userId === userId) {
      gameMap.delete(cardId);
    }
  }

  // Set new reservations
  for (const cardId of cardIds) {
    gameMap.set(cardId, { userId, roomType, expiresAt });
  }
}

/**
 * Release specific cards held by a user (e.g., after purchase or deselect).
 */
export function releaseCards(
  gameId: string,
  cardIds: number[],
  userId: string,
): void {
  const gameMap = store.get(gameId);
  if (!gameMap) return;

  for (const cardId of cardIds) {
    const res = gameMap.get(cardId);
    if (res && res.userId === userId) {
      gameMap.delete(cardId);
    }
  }
}

/**
 * Get all reserved cardIds for a game, optionally excluding one user's own cards.
 * (A player's own reservations are shown as "selected/mine", not "occupied by others".)
 */
export function getReservedCardIds(gameId: string, excludeUserId?: string): number[] {
  const gameMap = store.get(gameId);
  if (!gameMap) return [];

  const now = Date.now();
  const result: number[] = [];

  for (const [cardId, res] of gameMap.entries()) {
    if (res.expiresAt < now) continue;             // skip expired
    if (excludeUserId && res.userId === excludeUserId) continue; // skip self
    result.push(cardId);
  }

  return result;
}

/**
 * Clear ALL reservations for a game.
 * Called immediately when a game starts (runGame) — the primary cleanup path.
 */
export function clearGameReservations(gameId: string): void {
  const size = store.get(gameId)?.size ?? 0;
  store.delete(gameId);
  if (size > 0) {
    logger.info(`[CardReservations] Cleared ${size} reservation(s) for game ${gameId} (game started)`);
  }
}

/**
 * Prune expired reservations across all games.
 * Called on a 30-second interval — lightweight background sweep.
 */
export function clearExpiredReservations(): void {
  const now = Date.now();
  let totalCleared = 0;

  for (const [gameId, gameMap] of store.entries()) {
    for (const [cardId, res] of gameMap.entries()) {
      if (res.expiresAt < now) {
        gameMap.delete(cardId);
        totalCleared++;
      }
    }
    // Remove the outer game entry if it's now empty
    if (gameMap.size === 0) {
      store.delete(gameId);
    }
  }

  if (totalCleared > 0) {
    logger.info(`[CardReservations] TTL sweep: cleared ${totalCleared} expired reservation(s)`);
  }
}

// ── Start the background cleanup timer ───────────────────────────────────────
const cleanupTimer = setInterval(clearExpiredReservations, CLEANUP_INTERVAL_MS);

// Allow the process to exit cleanly even if this interval is running
if (cleanupTimer.unref) cleanupTimer.unref();
