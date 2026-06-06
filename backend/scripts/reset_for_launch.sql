-- ============================================================
-- BUNA BINGO — LAUNCH RESET SCRIPT
-- 
-- KEEPS:  ALL users (admins, agents, bots, players), rooms,
--         system_settings, agent pre-deposit wallet records
-- CLEARS: games, tickets, winners, draw_history,
--         transactions, deposits, withdrawals,
--         agent_commission_logs, admin_logs, promotions
-- RESETS: all wallet balances → 0, agent pre-deposit
--         balances → 0, jackpot → 0, system_wallet → 0,
--         game_cycles → 0
-- ============================================================

BEGIN;

-- 1. Draw history
DELETE FROM draw_history;

-- 2. Winners
DELETE FROM winners;

-- 3. Tickets
DELETE FROM tickets;

-- 4. Agent commission logs (history of debits/recharges)
DELETE FROM agent_commission_logs;

-- 5. Games
DELETE FROM games;

-- 6. Deposits
DELETE FROM deposits;

-- 7. Withdrawals
DELETE FROM withdrawals;

-- 8. Transactions
DELETE FROM transactions;

-- 9. Admin logs
DELETE FROM admin_logs;

-- 10. Promotions
DELETE FROM promotions;

-- 11. Reset ALL wallet balances to 0 (keep the wallet rows, just zero everything)
UPDATE wallets SET
  balance         = 0,
  credit          = 0,
  referral_balance = 0,
  bonus_balance   = 0,
  coins           = 0,
  total_deposited = 0,
  total_withdrawn = 0,
  total_won       = 0,
  total_spent     = 0,
  updated_at      = NOW();

-- 12. Reset agent pre-deposit wallet balances to 0 (keep the rows — agents stay intact)
UPDATE agent_pre_deposit_wallets SET
  balance        = 0,
  total_debited  = 0,
  total_recharged = 0,
  updated_at     = NOW();

-- 13. Reset Jackpot to 0
UPDATE jackpots SET
  current_amount = 0,
  last_won_at    = NOW(),
  last_winner_id = NULL,
  updated_at     = NOW();

-- 14. Reset System Wallet (company balance) to 0
UPDATE system_wallets SET balance = 0, updated_at = NOW();

-- 15. Reset Game Cycles counters to 0
UPDATE game_cycles SET total_games = 0, house_wins = 0, player_wins = 0;

-- ── Verification ──────────────────────────────────────────────
SELECT 'Total users (all kept):' AS label, COUNT(*) AS count FROM users;
SELECT 'Agents:' AS label, COUNT(*) AS count FROM users WHERE role = 'AGENT';
SELECT 'Admins:' AS label, COUNT(*) AS count FROM users WHERE is_admin = true;
SELECT 'Bots:' AS label, COUNT(*) AS count FROM users WHERE is_bot = true;
SELECT 'Games (must be 0):' AS label, COUNT(*) AS count FROM games;
SELECT 'Tickets (must be 0):' AS label, COUNT(*) AS count FROM tickets;
SELECT 'Transactions (must be 0):' AS label, COUNT(*) AS count FROM transactions;
SELECT 'Agent wallets (rows kept):' AS label, COUNT(*) AS count FROM agent_pre_deposit_wallets;

COMMIT;
