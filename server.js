const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Simple file logger ---
const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'server.log');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
function appendLog(line) {
  const timestamp = new Date().toISOString();
  const msg = `[${timestamp}] ${line}\n`;
  try { fs.appendFileSync(LOG_FILE, msg); } catch (e) { /* ignore */ }
  console.log(msg.trim());
}

// --- Admin config (load admins.json if present) ---
const ADMIN_CONFIG_PATH = path.join(__dirname, 'admins.json');
let adminConfig = { admins: [], tokens: [] };
try {
  if (fs.existsSync(ADMIN_CONFIG_PATH)) {
    adminConfig = JSON.parse(fs.readFileSync(ADMIN_CONFIG_PATH, 'utf8'));
  }
} catch (err) {
  appendLog('Failed to load admins.json, continuing with environment ADMIN_TOKEN only.');
}

function isAdminToken(token) {
  if (!token) return false;
  if (process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN) return true;
  return Array.isArray(adminConfig.tokens) && adminConfig.tokens.includes(token);
}

function getAdminById(id) {
  return (adminConfig.admins || []).find(a => String(a.id) === String(id));
}

function isTelegramAdmin(userId) {
  return !!getAdminById(userId);
}

// In-memory database store for loan applications
const applications = {};
let idCounter = 1;

// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID; // group chat by default
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || 'secret';
const SITE_URL = process.env.SITE_URL || 'https://your-domain.com';

function tgApiPath(method) {
  if (!TELEGRAM_BOT_TOKEN) return null;
  return `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`;
}

// Send Telegram notification with interactive inline buttons
// If application.assigned_admin && application.paid === true -> send to assigned admin chat only
async function sendTelegramNotification(appId, appData) {
  if (!TELEGRAM_BOT_TOKEN) {
    appendLog('Telegram bot token not configured. Skipping notification.');
    return;
  }

  const appRef = `APP-${new Date().toISOString().replace(/[:.]/g, '')}-${appId}`;
  appData.externalId = appRef;

  const baseMessage = `🔔 *New Loan Application Received!*\n\n` +
    `👤 *Name:* ${appData.name || '-'}\n` +
    `📱 *Phone:* ${appData.phone || '-'}\n` +
    `💰 *Amount:* K ${Number(appData.desired_amount || 0).toLocaleString()}\n` +
    `⏱ *Term:* ${appData.desired_term || '-'} Months\n` +
    `💼 *Employer/Status:* ${appData.employer || '-'}\n` +
    `📋 *Purpose:* ${appData.purpose || 'N/A'}\n` +
    `🆔 *App ID:* ${appRef}`;

  // If assigned admin exists and paid already set, send only to that admin
  if (appData.assigned_admin && appData.paid) {
    const admin = getAdminById(appData.assigned_admin);
    if (admin && admin.chat_id) {
      const keyboard = { inline_keyboard: [ [ { text: '✅ Approve', callback_data: `approveAssigned:${appId}` }, { text: '❌ Reject', callback_data: `rejectAssigned:${appId}` } ] ] };
      try {
        await axios.post(tgApiPath('sendMessage'), {
          chat_id: admin.chat_id,
          text: baseMessage,
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
        appendLog(`Sent private notification to admin ${admin.chat_id} for app ${appId}`);
        return;
      } catch (err) {
        appendLog('Failed to send message to assigned admin: ' + (err?.response?.data || err.message));
      }
    }
  }

  // Otherwise send to default TELEGRAM_CHAT_ID (group) and include PAID button if there's an assigned admin
  const keyboardButtons = [
    { text: '✅ Approve', callback_data: `approve:${appId}` },
    { text: '❌ Reject', callback_data: `reject:${appId}` }
  ];
  if (appData.assigned_admin) {
    keyboardButtons.push({ text: 'PAID', callback_data: `paid:${appId}` });
  }
  const keyboard = { inline_keyboard: [ keyboardButtons ] };

  try {
    await axios.post(tgApiPath('sendMessage'), {
      chat_id: TELEGRAM_CHAT_ID,
      text: baseMessage,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    appendLog(`Sent group notification to chat ${TELEGRAM_CHAT_ID} for app ${appId}`);
  } catch (error) {
    appendLog('Error sending Telegram notification: ' + (error?.response?.data || error.message));
  }
}

// API Routes
app.post('/applications', (req, res) => {
  const id = idCounter++;
  const newApp = {
    id,
    ...req.body,
    status: 'draft',
    createdAt: new Date(),
    paid: false // flag set when main admin taps PAID
  };
  applications[id] = newApp;
  appendLog(`Created application ${id}`);
  res.status(201).json(newApp);
});

// assign an admin to an application (protected by admin token)
app.post('/applications/:id/assign', (req, res) => {
  const token = req.query.token;
  if (!isAdminToken(token)) return res.status(403).json({ error: 'not_authorized' });
  const appId = req.params.id;
  const adminId = req.body.adminId;
  if (!applications[appId]) return res.status(404).json({ error: 'not_found' });
  if (!getAdminById(adminId)) return res.status(400).json({ error: 'invalid_admin' });
  applications[appId].assigned_admin = adminId;
  appendLog(`Assigned admin ${adminId} to app ${appId}`);
  res.json({ success: true, application: applications[appId] });
});

app.patch('/applications/:id', (req, res) => {
  const id = req.params.id;
  const existing = applications[id];
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const updated = { ...existing, ...req.body, updatedAt: new Date() };
  applications[id] = updated;
  appendLog(`Updated application ${id}`);
  res.json(updated);
});

app.post('/applications/:id/submit', async (req, res) => {
  const appItem = applications[req.params.id];
  if (!appItem) return res.status(404).json({ error: 'Application not found' });

  appItem.status = 'pending';
  appendLog(`Submitted application ${appItem.id}`);
  await sendTelegramNotification(appItem.id, appItem);
  res.json({ success: true, message: 'Application submitted and notification sent.', application: appItem });
});

app.get('/applications/:id', (req, res) => {
  const appItem = applications[req.params.id];
  if (!appItem) return res.status(404).json({ error: 'Application not found' });
  res.json(appItem);
});

// Debug endpoint - returns basic status and last logs
app.get('/debug', (req, res) => {
  const logs = (() => {
    try {
      const raw = fs.readFileSync(LOG_FILE, 'utf8');
      const lines = raw.split('\n').filter(Boolean);
      return lines.slice(-500); // last 500 lines
    } catch (e) {
      return [`No log file found at ${LOG_FILE}`];
    }
  })();

  res.json({
    status: 'ok',
    uptime_seconds: process.uptime(),
    memory: process.memoryUsage(),
    env: {
      PORT: process.env.PORT,
      SITE_URL: process.env.SITE_URL,
      TELEGRAM_CHAT_ID: !!process.env.TELEGRAM_CHAT_ID,
      TELEGRAM_BOT_TOKEN_SET: !!process.env.TELEGRAM_BOT_TOKEN
    },
    pending_applications: Object.values(applications).filter(a => a.status === 'pending').length,
    applications_count: Object.keys(applications).length,
    logs_tail: logs
  });
});

// Telegram Webhook Handler for Button Interactions (with logging + immediate ack)
app.post(`/telegram/webhook/${TELEGRAM_WEBHOOK_SECRET}`, async (req, res) => {
  const update = req.body;
  appendLog('Received Telegram update: ' + JSON.stringify(update).slice(0,2000));

  // Immediately respond 200 to Telegram so it doesn't retry
  res.status(200).send('OK');

  try {
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      appendLog('Callback query received from: ' + (callbackQuery.from && callbackQuery.from.id) + ' data: ' + callbackQuery.data);

      // Immediate acknowledgement so Telegram UI stops the spinner
      try {
        await axios.post(tgApiPath('answerCallbackQuery'), { callback_query_id: callbackQuery.id, text: 'Processing...' });
      } catch (err) {
        appendLog('Immediate answerCallbackQuery failed: ' + (err?.response?.data || err.message));
      }

      const [action, appIdStr] = callbackQuery.data.split(':');
      const appId = String(appIdStr);
      const app = applications[appId];
      const from = callbackQuery.from || {};

      // Handle PAID action: mark app.paid = true and send the app privately to the assigned admin
      if (action === 'paid') {
        if (!app) return;
        // Only allow main admins (from config) to mark PAID — check isTelegramAdmin
        if (!isTelegramAdmin(from.id)) {
          try {
            await axios.post(tgApiPath('answerCallbackQuery'), { callback_query_id: callbackQuery.id, text: 'Unauthorized', show_alert: false });
          } catch (err) { appendLog('answerCallbackQuery error (unauthorized): ' + (err?.response?.data || err.message)); }
          return;
        }
        app.paid = true;
        // send to assigned admin if available
        if (app.assigned_admin) {
          const admin = getAdminById(app.assigned_admin);
          if (admin && admin.chat_id) {
            const adminCode = admin.code || String(admin.id);
            const adminLink = `${SITE_URL}/admin/${adminCode}`;
            const adminMsg = `WELCOME TO ZAMBIA LOAN APP\n\nYou have been assigned an application to review:\n\nApp ID: ${app.externalId || ('APP-' + appId)}\nName: ${app.name || '-'}\nPhone: ${app.phone || '-'}\nAmount: K ${Number(app.desired_amount || 0).toLocaleString()}\n\nUse this admin link when acting: ${adminLink}\n\nThanks.`;
            const adminKeyboard = { inline_keyboard: [ [ { text: '✅ Approve', callback_data: `approveAssigned:${appId}` }, { text: '❌ Reject', callback_data: `rejectAssigned:${appId}` } ] ] };
            try {
              await axios.post(tgApiPath('sendMessage'), { chat_id: admin.chat_id, text: adminMsg, parse_mode: 'Markdown', reply_markup: adminKeyboard });
              appendLog(`Sent private assignment message to ${admin.chat_id} for app ${appId}`);
            } catch (err) { appendLog('Failed to send private assignment message: ' + (err?.response?.data || err.message)); }

            // Acknowledge in group
            try {
              await axios.post(tgApiPath('answerCallbackQuery'), { callback_query_id: callbackQuery.id, text: 'Assigned admin notified.', show_alert: false });
            } catch (err) { appendLog('answerCallbackQuery ack error: ' + (err?.response?.data || err.message)); }

            // Optionally edit the group message to reflect assignment
            try {
              await axios.post(tgApiPath('editMessageText'), { chat_id: callbackQuery.message.chat.id, message_id: callbackQuery.message.message_id, text: callbackQuery.message.text + `\n\n*Status:* Assigned to ${admin.username || admin.name}`, parse_mode: 'Markdown' });
            } catch (e) { appendLog('editMessageText failed: ' + (e?.response?.data || e.message)); }
          }
        }
        return;
      }

      // Main group approve/reject (action: approve / reject)
      if (action === 'approve' || action === 'reject') {
        if (!app) return;
        // Only allow group admins (from config) to approve in group
        if (!isTelegramAdmin(from.id)) {
          try { await axios.post(tgApiPath('answerCallbackQuery'), { callback_query_id: callbackQuery.id, text: 'Unauthorized', show_alert: false }); } catch (err) { appendLog('answerCallbackQuery error (unauthorized): ' + (err?.response?.data || err.message)); }
          return;
        }
        app.status = action === 'approve' ? 'approved' : 'rejected';
        app.updatedAt = new Date();
        // acknowledge and update message in group
        try { await axios.post(tgApiPath('answerCallbackQuery'), { callback_query_id: callbackQuery.id, text: `Application ${action}d.`, show_alert: false }); } catch (err) { appendLog('answerCallbackQuery error: ' + (err?.response?.data || err.message)); }
        try {
          await axios.post(tgApiPath('editMessageText'), { chat_id: callbackQuery.message.chat.id, message_id: callbackQuery.message.message_id, text: callbackQuery.message.text + `\n\n*Status:* ${action === 'approve' ? '✅ Approved' : '❌ Rejected'}`, parse_mode: 'Markdown' });
          appendLog(`Application ${appId} ${action}d in group by ${from.id}`);
        } catch (e) { appendLog('editMessageText failed: ' + (e?.response?.data || e.message)); }
        return;
      }

      // Assigned admin approves/rejects privately (approveAssigned / rejectAssigned)
      if (action === 'approveAssigned' || action === 'rejectAssigned') {
        if (!app) return;
        // Only the assigned admin may perform this action
        if (!app.assigned_admin || String(from.id) !== String(app.assigned_admin)) {
          try { await axios.post(tgApiPath('answerCallbackQuery'), { callback_query_id: callbackQuery.id, text: 'You are not the assigned reviewer for this application.', show_alert: false }); } catch (err) { appendLog('answerCallbackQuery error (not assigned): ' + (err?.response?.data || err.message)); }
          return;
        }
        app.status = action === 'approveAssigned' ? 'approved' : 'rejected';
        app.updatedAt = new Date();
        // acknowledge to the assigned admin and edit their private message
        try { await axios.post(tgApiPath('answerCallbackQuery'), { callback_query_id: callbackQuery.id, text: `You have ${action === 'approveAssigned' ? 'approved' : 'rejected'} this application.`, show_alert: false }); } catch (err) { appendLog('answerCallbackQuery error: ' + (err?.response?.data || err.message)); }
        try {
          await axios.post(tgApiPath('editMessageText'), { chat_id: callbackQuery.message.chat.id, message_id: callbackQuery.message.message_id, text: callbackQuery.message.text + `\n\n*Status:* ${action === 'approveAssigned' ? '✅ Approved' : '❌ Rejected'}`, parse_mode: 'Markdown' });
          appendLog(`Application ${appId} ${action === 'approveAssigned' ? 'approved' : 'rejected'} by assigned admin ${from.id}`);
        } catch (e) { appendLog('editMessageText failed: ' + (e?.response?.data || e.message)); }
        return;
      }
    }
  } catch (err) {
    appendLog('Webhook handler error: ' + (err?.response?.data || err.message));
  }
});

// Admin Route Guard
app.get('/admin', (req, res) => {
  const token = req.query.token;
  if (isAdminToken(token)) {
    return res.json({ success: true, applications });
  }
  res.sendFile(path.join(__dirname, 'public', 'access-denied.html'));
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  appendLog(`Server running on port ${PORT}`);
});
