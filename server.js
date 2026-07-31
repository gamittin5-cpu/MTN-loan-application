const express = require('express');
const path = require('path');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || ''; // optional secret in webhook path

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper: build Telegram API URL
function tgApiPath(method) {
  if (!TELEGRAM_BOT_TOKEN) return null;
  return `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`;
}

// ===== In-memory storage (replace with DB in production) =====
let inMemoryApplications = {};
let nextAppId = 1;

// Zambia phone regex: E.164 starting with +260 and 9 digits after (e.g. +260971234567)
const zambiaPhoneRegex = /^\+260\d{9}$/;

// ===== Serve admin route (simple token check) =====
app.get('/admin', (req, res) => {
  const token = req.query.token || '';
  if (ADMIN_TOKEN && token === ADMIN_TOKEN) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(403).sendFile(path.join(__dirname, 'public', 'access-denied.html'));
  }
});

// Health check (Render)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ===== Application APIs =====
app.post('/applications', (req, res) => {
  const id = String(nextAppId++);
  const now = new Date().toISOString();
  const appObj = {
    id,
    status: 'draft',
    created_at: now,
    updated_at: now,
    ...req.body
  };
  inMemoryApplications[id] = appObj;
  res.status(201).json(appObj);
});

app.patch('/applications/:id', (req, res) => {
  const id = req.params.id;
  const existing = inMemoryApplications[id];
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const updated = { ...existing, ...req.body, updated_at: new Date().toISOString() };
  inMemoryApplications[id] = updated;
  res.json(updated);
});

// When application submitted, validate fields, then notify admin via Telegram with inline buttons
app.post('/applications/:id/submit', async (req, res) => {
  const id = req.params.id;
  const existing = inMemoryApplications[id];
  if (!existing) return res.status(404).json({ error: 'Not found' });

  // Server-side validation: ensure required fields present and valid
  const errors = [];
  if (!existing.name || String(existing.name).trim().length < 2) errors.push('name');
  if (!existing.phone || !zambiaPhoneRegex.test(String(existing.phone).trim())) errors.push('phone');
  if (!existing.employer || String(existing.employer).trim().length < 2) errors.push('employer');
  const incomeVal = Number(existing.income || 0);
  if (!(incomeVal > 0)) errors.push('income');

  if (errors.length) {
    return res.status(400).json({ error: 'validation_failed', missing: errors, message: 'Please complete all required application steps before submitting.' });
  }

  existing.status = 'pending';
  existing.updated_at = new Date().toISOString();

  // Send Telegram notification with inline approve/reject buttons
  try {
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const text = `New loan application: #${id}\n\nName: ${existing.name || '-'}\nPhone: ${existing.phone || '-'}\nIncome: ${existing.income || '-'}\nAmount requested: K ${existing.desired_amount || '-'}\nTerm (months): ${existing.desired_term || '-'}\n\nTap to approve or reject.`;
      const keyboard = {
        inline_keyboard: [
          [
            { text: '✅ Approve', callback_data: `approve:${id}` },
            { text: '❌ Reject', callback_data: `reject:${id}` }
          ]
        ]
      };
      await axios.post(tgApiPath('sendMessage'), {
        chat_id: TELEGRAM_CHAT_ID,
        text,
        reply_markup: keyboard
      });
    } else {
      console.warn('Telegram bot token or chat id not configured; skipping notification.');
    }
  } catch (err) {
    console.error('Failed to send Telegram notification', err?.response?.data || err.message || err);
  }

  res.json({ id, status: existing.status });
});

app.get('/applications/:id', (req, res) => {
  const id = req.params.id;
  const existing = inMemoryApplications[id];
  if (!existing) return res.status(404).json({ error: 'Not found' });
  res.json(existing);
});

// ===== Telegram webhook endpoint to handle callback queries =====
// webhook URL pattern: /telegram/webhook or /telegram/webhook/<secret> if you set TELEGRAM_WEBHOOK_SECRET
const webhookBase = TELEGRAM_WEBHOOK_SECRET ? `/telegram/webhook/${TELEGRAM_WEBHOOK_SECRET}` : `/telegram/webhook`;
app.post(webhookBase, async (req, res) => {
  // Telegram updates are JSON bodies. We handle callback_query for approve/reject actions.
  const body = req.body;

  // Immediately reply 200 to Telegram to avoid retries
  res.sendStatus(200);

  if (!body) return;

  // handle callback_query
  if (body.callback_query) {
    const cb = body.callback_query;
    const data = cb.data || ''; // e.g. "approve:123"
    const from = cb.from || {};
    const message = cb.message || {};
    const chat = message.chat || {};

    // Verify this callback comes from the configured chat (if set)
    if (TELEGRAM_CHAT_ID && String(chat.id) !== String(TELEGRAM_CHAT_ID)) {
      // ignore or optionally inform the user
      try {
        await axios.post(tgApiPath('answerCallbackQuery'), {
          callback_query_id: cb.id,
          text: 'Unauthorized action.',
          show_alert: false
        });
      } catch (err) {
        console.warn('answerCallbackQuery failed', err?.response?.data || err.message);
      }
      return;
    }

    // Parse action and id
    const [action, appId] = (data || '').split(':');
    if (!action || !appId) {
      try {
        await axios.post(tgApiPath('answerCallbackQuery'), {
          callback_query_id: cb.id,
          text: 'Invalid action.',
          show_alert: false
        });
      } catch (err) { /* ignore */ }
      return;
    }

    const application = inMemoryApplications[appId];
    if (!application) {
      try {
        await axios.post(tgApiPath('answerCallbackQuery'), {
          callback_query_id: cb.id,
          text: `Application #${appId} not found.`,
          show_alert: false
        });
      } catch (err) { /* ignore */ }
      return;
    }

    // Update application status
    if (action === 'approve') {
      application.status = 'approved';
      application.updated_at = new Date().toISOString();
      // edit original Telegram message to reflect approval
      try {
        await axios.post(tgApiPath('editMessageText'), {
          chat_id: chat.id,
          message_id: message.message_id,
          text: `Application #${appId} — ✅ Approved by @${from.username || from.first_name || from.id}`
        });
        await axios.post(tgApiPath('answerCallbackQuery'), {
          callback_query_id: cb.id,
          text: 'Application approved.',
          show_alert: false
        });
      } catch (err) {
        console.error('Failed to edit telegram message or answer callback', err?.response?.data || err.message);
      }
    } else if (action === 'reject') {
      application.status = 'rejected';
      application.updated_at = new Date().toISOString();
      try {
        await axios.post(tgApiPath('editMessageText'), {
          chat_id: chat.id,
          message_id: message.message_id,
          text: `Application #${appId} — ❌ Rejected by @${from.username || from.first_name || from.id}`
        });
        await axios.post(tgApiPath('answerCallbackQuery'), {
          callback_query_id: cb.id,
          text: 'Application rejected.',
          show_alert: false
        });
      } catch (err) {
        console.error('Failed to edit telegram message or answer callback', err?.response?.data || err.message);
      }
    } else {
      try {
        await axios.post(tgApiPath('answerCallbackQuery'), {
          callback_query_id: cb.id,
          text: 'Unknown action.',
          show_alert: false
        });
      } catch (err) { /* ignore */ }
    }

    // Here you could also notify the applicant via SMS/Push/Email or update DB.
  }

  // handle other update types (optional)
});

// Fallback SPA route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  if (TELEGRAM_WEBHOOK_SECRET) {
    console.log(`Telegram webhook listening at POST ${webhookBase}`);
  } else {
    console.log('Telegram webhook endpoint: POST /telegram/webhook (no secret configured)');
  }
});
