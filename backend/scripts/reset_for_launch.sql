-- ============================================================
-- BUNA BINGO — SAFE PRODUCTION RESET SCRIPT
-- Run this ONCE before going live.
-- 
-- KEEPS:  admin users, bot users, rooms, system_settings
-- CLEARS: all player data, games, tickets, transactions,
--         deposits, withdrawals, winners, draw_history,
--         agent_commission_logs, agent_pre_deposit_wallets,
--         wallets (non-admin/non-bot), jackpot balance,
--         system_wallet balance, game_cycles, admin_logs,
--         promotions
-- ============================================================

BEGIN;

-- 1. Draw history (depends on games)
DELETE FROM draw_history;

-- 2. Winners (depends on games, tickets, users)
DELETE FROM winners;

-- 3. Tickets (depends on games, users)
DELETE FROM tickets;

-- 4. Agent commission logs (depends on agent_pre_deposit_wallets, users)
DELETE FROM agent_commission_logs;

-- 5. Games (depends on rooms)
DELETE FROM games;

-- 6. Deposits
DELETE FROM deposits;

-- 7. Withdrawals
DELETE FROM withdrawals;

-- 8. Transactions
DELETE FROM transactions;

-- 9. Admin logs
DELETE FROM admin_logs;

-- 10. Agent pre-deposit wallets — only for real (non-bot, non-admin) agents
DELETE FROM agent_pre_deposit_wallets
WHERE agent_id IN (
  SELECT id FROM users WHERE is_bot = false AND is_admin = false AND role != 'ADMIN'
);

-- 11. Wallets — only for real players (keep admin + bot wallets)
DELETE FROM wallets
WHERE user_id IN (
  SELECT id FROM users WHERE is_bot = false AND is_admin = false AND role != 'ADMIN'
);

-- 12. Delete real users (players/agents) — keep bots and admins
DELETE FROM users
WHERE is_bot = false
  AND is_admin = false
  AND role NOT IN ('ADMIN', 'SUPERADMIN');

-- 13. Reset Jackpot balance to 0
UPDATE jackpots SET current_amount = 0, last_won_at = NOW(), last_winner_id = NULL, updated_at = NOW();

-- 14. Reset System Wallet (company balance) to 0
UPDATE system_wallets SET balance = 0, updated_at = NOW();

-- 15. Reset Game Cycles counters
UPDATE game_cycles SET total_games = 0, house_wins = 0, player_wins = 0;

-- 16. Clear Promotions
DELETE FROM promotions;

-- Verify what's left
SELECT 'Users remaining (admins + bots):' AS check_label, COUNT(*) AS count FROM users;
SELECT 'Bot users:' AS check_label, COUNT(*) AS count FROM users WHERE is_bot = true;
SELECT 'Admin users:' AS check_label, COUNT(*) AS count FROM users WHERE is_admin = true;
SELECT 'Rooms:' AS check_label, COUNT(*) AS count FROM rooms;
SELECT 'System settings:' AS check_label, COUNT(*) AS count FROM system_settings;
SELECT 'Games remaining (should be 0):' AS check_label, COUNT(*) AS count FROM games;
SELECT 'Tickets remaining (should be 0):' AS check_label, COUNT(*) AS count FROM tickets;
SELECT 'Transactions remaining (should be 0):' AS check_label, COUNT(*) AS count FROM transactions;

COMMIT;
