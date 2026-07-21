const { pool } = require('./db');

async function setup() {
  try {
    console.log('Creating React Native Wallet tables...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_wallets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        balance DECIMAL(20,4) NOT NULL DEFAULT 0.0000,
        total_deposited DECIMAL(20,4) NOT NULL DEFAULT 0.0000,
        total_withdrawn DECIMAL(20,4) NOT NULL DEFAULT 0.0000,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✅ app_wallets table ready');

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
    console.log('✅ app_deposits table ready');

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
    console.log('✅ app_withdrawals table ready');

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
    console.log('✅ app_transactions table ready');

    console.log('🎉 Setup complete!');
  } catch (err) {
    console.error('❌ Setup failed:', err);
  } finally {
    pool.end();
  }
}

setup();
