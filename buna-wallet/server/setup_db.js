const { pool } = require('./db');

async function initTables() {
  try {
    console.log('[DB Setup] Ensuring React Native Wallet tables exist...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_wallets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        pin VARCHAR(255),
        balance DECIMAL(20,4) NOT NULL DEFAULT 0.0000,
        total_deposited DECIMAL(20,4) NOT NULL DEFAULT 0.0000,
        total_withdrawn DECIMAL(20,4) NOT NULL DEFAULT 0.0000,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    
    // Auto-add pin column if it doesn't exist (for existing databases)
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_wallets' AND column_name = 'pin') THEN
          ALTER TABLE app_wallets ADD COLUMN pin VARCHAR(255);
        END IF;
      END
      $$;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_deposits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        amount DECIMAL(20,4) NOT NULL,
        txn_id VARCHAR(50) NOT NULL UNIQUE,
        receipt_url TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_withdrawals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        amount DECIMAL(20,4) NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        account_number VARCHAR(100) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        type VARCHAR(50) NOT NULL,
        amount DECIMAL(20,4) NOT NULL,
        balance_before DECIMAL(20,4) NOT NULL,
        balance_after DECIMAL(20,4) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'completed',
        reference_id VARCHAR(100),
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    console.log('[DB Setup] ✅ React Native Wallet tables ready');
  } catch (err) {
    console.error('[DB Setup] ❌ Setup failed:', err.message);
  }
}

module.exports = { initTables };

if (require.main === module) {
  initTables().then(() => pool.end());
}
