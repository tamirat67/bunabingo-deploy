# Buna Wallet OTP Server

A lightweight Express.js backend for OTP authentication via Telerivet SMS.

## Setup

```bash
cd server
npm install
cp .env.example .env
# Fill in your Telerivet credentials in .env
npm run dev
```

## Endpoints

- `POST /api/otp/send`    — Send OTP to phone number
- `POST /api/otp/verify`  — Verify OTP code
- `GET  /api/health`      — Health check
