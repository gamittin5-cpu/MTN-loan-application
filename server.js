const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory database store for loan applications
const applications = {};
let idCounter = 1;

// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || 'secret';

// Send Telegram notification with interactive inline buttons
async function sendTelegramNotification(appId, appData) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('Telegram credentials not configured. Skipping notification.');
    return;
  }

  const message = `🔔 *New Loan Application Received!*\n\n` +
    `👤 *Name:* ${appData.name}\n` +
    `📱 *Phone:* ${appData.phone}\n` +
    `💰 *Amount:* ZMW ${Number(appData.desired_amount).toLocaleString()}\n` +
    `⏱ *Term:* ${appData.desired_term} Months\n` +
    `💼 *Employer/Status:* ${appData.employer}\n` +
    `📋 *Purpose:* ${appData.purpose || 'N/A'}\n` +
    `🆔 *App ID:* APP-${1785526685654 + Number(appId)}`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Approve', callback_data: `approve:${appId}` },
        { text: '❌ Reject', callback_data: `reject:${appId}` }
      ]
    ]
  };

  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } catch (error) {
    console.error('Error sending Telegram notification:', error.response?.data || error.message);
  }
}

// API Routes
app.post('/applications', (req, res) => {
  const id = idCounter++;
  const newApp = {
    id,
    ...req.body,
    status: 'pending',
    createdAt: new Date()
  };
  applications[id] = newApp;
  res.status(201).json(newApp);
});

app.post('/applications/:id/submit', async (req, res) => {
  const appItem = applications[req.params.id];
  if (!appItem) return res.status(404).json({ error: 'Application not found' });
  
  await sendTelegramNotification(appItem.id, appItem);
  res.json({ success: true, message: 'Application submitted and notification sent.' });
});

app.get('/applications/:id', (req, res) => {
  const appItem = applications[req.params.id];
  if (!appItem) return res.status(404).json({ error: 'Application not found' });
  res.json(appItem);
});

// Telegram Webhook Handler for Button Interactions
app.post(`/telegram/webhook/${TELEGRAM_WEBHOOK_SECRET}`, async (req, res) => {
  const update = req.body;
  if (update.callback_query) {
    const callbackQuery = update.callback_query;
    const [action, appIdStr] = callbackQuery.data.split(':');
    const appId = Number(appIdStr);

    if (applications[appId]) {
      if (action === 'approve') {
        applications[appId].status = 'approved';
      } else if (action === 'reject') {
        applications[appId].status = 'rejected';
      }

      // Answer callback query to remove loading state on button
      try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
          callback_query_id: callbackQuery.id,
          text: `Application ${action}d successfully!`
        });

        // Edit message to reflect status
        const newText = callbackQuery.message.text + `\n\n*Status:* — ${action === 'approve' ? '✅ Approved' : '❌ Rejected'}`;
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
          chat_id: callbackQuery.message.chat.id,
          message_id: callbackQuery.message.message_id,
          text: newText,
          parse_mode: 'Markdown'
        });
      } catch (e) {
        console.error('Error updating Telegram message:', e.message);
      }
    }
  }
  res.status(200).send('OK');
});

// Admin Route Guard
app.get('/admin', (req, res) => {
  const token = req.query.token;
  if (token === process.env.ADMIN_TOKEN) {
    return res.json({ success: true, applications });
  }
  res.sendFile(path.join(__dirname, 'public', 'access-denied.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
