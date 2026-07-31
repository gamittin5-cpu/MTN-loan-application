# MTN MoMo Loan Application System

A full-stack Node.js application for managing loan applications with Telegram bot integration for real-time admin approvals.

Features
- Landing view with MTN MoMo branding and interactive loan calculator (ZMW/Kwacha)
- 3-step loan application: loan type & purpose, personal info, employment & income
- Login via MoMo phone + 5-digit PIN (frontend simulated)
- SMS copy/paste verification with 59s countdown and OTP verification
- Admin approval via Telegram inline buttons (Approve / Reject)
- In-memory demo storage (replace with Postgres/Mongo for production)

Setup
1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file (copy from `.env.example`) and set values:

```
PORT=3000
ADMIN_TOKEN=your_secure_admin_token_here
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret_here
```

3. Run the server:

```bash
npm start
```

API Endpoints
- POST /applications — create a draft application
- POST /applications/:id/submit — submit and notify admin via Telegram
- GET /applications/:id — fetch application
- POST /telegram/webhook/:secret — Telegram callback handler (set webhook to this URL)
- GET /admin?token=... — admin JSON view (requires ADMIN_TOKEN)

Notes
- This repository is a demo scaffold. Replace the in-memory "applications" store with a persistent database for production.
- Add server-side validation, rate limiting, and secure handling of OTP/SMS when integrating real MoMo providers.
