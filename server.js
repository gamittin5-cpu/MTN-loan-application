const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage for applications
const applications = {};

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// 1. Create a new loan application
app.post('/applications', (req, res) => {
  const appId = 'APP-' + Math.floor(100000000 + Math.random() * 900000000);
  applications[appId] = {
    id: appId,
    ...req.body,
    status: 'pending'
  };
  res.json({ id: appId });
});

// 2. Submit application and trigger Telegram notification with inline buttons
app.post('/applications/:id/submit', async (req, res) => {
  const appId = req.params.id;
  const appData = applications[appId];

  if (!appData) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const message = `🔔 *New Loan Application Received!*\n\n` +
    `👤 *Name:* ${appData.name}\n` +
    `📱 *Phone:* ${appData.phone}\n` +
    `💰 *Amount:* ZMW ${Number(appData.desired_amount).toLocaleString()}\n` +
    `⏱️ *Term:* ${appData.desired_term} Months\n` +
    `💼 *Employer/Status:* ${appData.employer}\n` +
    `📄 *Purpose:* ${appData.purpose}\n` +
    `🆔 *App ID:* ${appId}`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Approve', callback_data: `approve_${appId}` },
        { text: '❌ Reject', callback_data: `reject_${appId}` }
      ]
    ]
  };

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      })
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Telegram notification error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// 3. Poll application status from frontend
app.get('/applications/:id', (req, res) => {
  const appData = applications[req.params.id];
  if (!appData) {
    return res.status(404).json({ error: 'Application not found' });
  }
  res.json(appData);
});

// 4. Telegram Webhook Endpoint to handle Inline Button Clicks
app.post('/telegram-webhook', async (req, res) => {
  const update = req.body;

  if (update.callback_query) {
    const callbackQuery = update.callback_query;
    const data = callbackQuery.data; 
    const [action, appId] = data.split('_');

    if (applications[appId]) {
      if (action === 'approve') {
        applications[appId].status = 'approved';
      } else if (action === 'reject') {
        applications[appId].status = 'rejected';
      }
    }

    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQuery.id,
          text: `Application successfully ${action}d!`
        })
      });
    } catch (e) {
      console.error('Error answering callback query:', e);
    }
  }

  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
