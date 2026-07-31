# Loan UI (Express + Static Frontend) with Telegram admin approval

This project implements the UI and an Express API that notifies an admin via Telegram when a new application is submitted. Admins can Approve or Reject using inline buttons (Telegram). This demo uses in-memory storage — replace with a DB for production.

Environment variables
- ADMIN_TOKEN — existing admin token used for /admin route (optional)
- TELEGRAM_BOT_TOKEN — required for Telegram integration (from BotFather)
- TELEGRAM_CHAT_ID — chat id (group or user) where the bot sends notifications
- TELEGRAM_WEBHOOK_SECRET — optional secret segment to include in webhook path (recommended)
- PORT — server port (default 3000)

How it works
- On application submit (POST /applications/:id/submit) the server sends a Telegram message to TELEGRAM_CHAT_ID with Approve / Reject inline buttons.
- You must configure Telegram to send webhook updates to your server (see below). When a callback_query arrives at the webhook endpoint, the server updates the application status and edits the Telegram message to show who acted.

Set Telegram webhook (after deploying)
- If you set TELEGRAM_WEBHOOK_SECRET to e.g. mysecret, set webhook URL to:
  https://<your-domain>/telegram/webhook/mysecret
- If no secret set, webhook URL:
  https://<your-domain>/telegram/webhook

Set webhook via curl:
```
curl -X GET "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<your-domain>/telegram/webhook/<OPTIONAL_SECRET>"
```
Replace `<TELEGRAM_BOT_TOKEN>` and `<your-domain>`.

Example flow
1. User starts application (frontend calls POST /applications) — in-memory draft is created.
2. User fills steps, submits (POST /applications/:id/submit).
3. Server sets status pending and sends Telegram message with inline buttons to TELEGRAM_CHAT_ID.
4. Admin taps Approve/Reject in Telegram; Telegram sends callback_query to your webhook.
5. Server processes callback, updates application status (approved/rejected) and edits the Telegram message.

Security notes & next steps
- Replace in-memory storage with a DB (Postgres, Mongo, etc.) and persist admin actions.
- Verify webhook origin: Telegram does not sign payloads; use a secret path (TELEGRAM_WEBHOOK_SECRET) and TLS-only webhook URL.
- Consider checking callback_query.from.id against a list of allowed admin user IDs (if you want only specific users to be allowed).
- Add audit logging and notify applicant after admin action.
- Use rate limiting and enforce strong admin auth for /admin route.

What I recommend you do next (quick checklist)
1. Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to your Render environment.
2. Deploy the service.
3. Set Telegram webhook to point to https://<your-render-service>/telegram/webhook/<optional-secret>.
4. Test: submit an application via the UI and click Approve/Reject in Telegram.
5. Replace in-memory storage with a real DB and extend notifications to applicants.
