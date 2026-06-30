# Fast Keno — module for your Next.js + Prisma + Telegraf stack

This is an **independent feature module**, not a replacement for any of
your existing systems. It adds its own `keno_*` tables and runs as its
own always-on worker process, talking to your app only through:
1. Prisma (shared Postgres database)
2. A `WalletAdapter` interface you implement against your real wallet code
3. HTTP/WebSocket, called from Next.js API routes

## Why a separate worker process

Next.js API routes (and most serverless hosting) don't stay alive between
requests, so a `setInterval`-driven 4-second round loop and in-memory round
state can't safely live there — you'd get duplicated/dropped rounds. The
`src/worker/` process is a plain long-running Node process (run it with
pm2, systemd, or a Docker container) that owns the DrawEngine and exposes
a small internal HTTP API + WebSocket for everything else to use.

If your Telegraf bot already runs as one always-on process, you can also
import `DrawEngine` directly into that process instead of running a
separate worker — same code, just import `src/keno/drawEngine.ts` there.

## Setup steps

1. **Merge the schema.** Copy the contents of `prisma/keno.prisma.snippet`
   into your existing `prisma/schema.prisma` (don't create a second schema
   file). Adjust the commented-out `User` relation to match your real model.
   Then:
   ```bash
   npx prisma migrate dev --name add_fast_keno
   ```

2. **Wire your wallet.** Open `src/keno/walletAdapter.ts` and implement
   `debit()` / `credit()` / `getBalanceCents()` against your existing
   wallet/ledger functions. This is the single most important step —
   read the safety notes in that file before writing it.

3. **Seed the payout table** (optional — a sane default paytable is built
   in as a fallback). Use the admin endpoints once the worker is running,
   or insert rows into `keno_payout_table` directly.

4. **Run the worker:**
   ```bash
   npm install
   npx ts-node-dev src/worker/index.ts
   # or after `npm run build`: node dist/worker/index.js
   ```
   Set env vars: `DATABASE_URL`, `KENO_HTTP_PORT` (default 8090),
   `KENO_WS_PORT` (default 8091), `KENO_INTERNAL_SECRET` (shared secret
   between Next.js and the worker — see security note below).

5. **Copy `nextjs-integration/` into your Next.js app**, adjusting:
   - The auth comments in `app/api/keno/*/route.ts` — replace the `userId`
     placeholders with your real session check. **Do not ship this with
     userId taken from the request body** — that lets anyone bet as anyone.
   - `NEXT_PUBLIC_KENO_WS_URL` and `KENO_WORKER_URL` env vars.

## Real-money safety checklist before going live

- [ ] `WalletAdapter.debit/credit` are atomic and idempotent on your end
      (retrying the same `idempotencyKey` must not double-charge/double-pay)
- [ ] Auth: ticket placement uses your verified session `userId`, never a
      client-supplied one
- [ ] The worker's HTTP API (`KENO_HTTP_PORT`) is **not** publicly exposed —
      only Next.js's server should reach it (internal network, firewall
      rule, or the `KENO_INTERNAL_SECRET` header check at minimum)
- [ ] Admin endpoints (`/keno/admin/*`) are additionally gated by your
      existing admin auth in the Next.js proxy layer
- [ ] You've reviewed `keno_audit_log` and have a process for manually
      reconciling any `DEBIT_FAILED` rows (a credit failure after a win —
      logged loudly on purpose, never silently dropped)
- [ ] Min/max stake (`keno_config`) are set to values appropriate for your
      jurisdiction/risk tolerance
- [ ] You understand your jurisdiction's licensing requirements for
      real-money keno before launching publicly — this module gives you
      the mechanics, not legal compliance

## What's still missing

- Responsible-gambling controls (deposit/loss limits, self-exclusion,
  session reminders) — required in most regulated markets
- Rate limiting on ticket placement
- Horizontal scaling story for the worker (currently single-instance only)
- A polished admin dashboard UI — only the API exists; wire it into
  whatever admin panel you already built for the bingo bot
