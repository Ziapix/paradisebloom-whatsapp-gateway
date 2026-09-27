const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const app = express();
const PORT = process.env.PORT || 3301;
const AUTH_DIR = path.join(__dirname, 'auth_info_baileys');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let sock = null;
let isConnected = false;
let latestQrRaw = null;
let latestQrDataUrl = null;
let connectedUser = null;
let isConnecting = false;

// Format phone number to WhatsApp JID (e.g. +91 9876543210 -> 919876543210@s.whatsapp.net)
function formatJid(phone) {
  let clean = String(phone || '').replace(/[^0-9]/g, '');
  if (clean.length === 10) {
    clean = '91' + clean;
  }
  return `${clean}@s.whatsapp.net`;
}

async function connectToWhatsApp() {
  if (isConnecting) return;
  isConnecting = true;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

    sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: true,
      browser: ['Paradise Bloom', 'Safari', '17.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        latestQrRaw = qr;
        try {
          latestQrDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 8 });
        } catch (e) {
          console.error('Failed to generate QR data URL:', e);
        }
        isConnected = false;
        connectedUser = null;
        console.log('⚡ [Paradise Bloom] New WhatsApp QR Code generated. Scan with phone: WhatsApp -> Linked Devices -> Link a Device');
      }

      if (connection === 'open') {
        isConnected = true;
        latestQrRaw = null;
        latestQrDataUrl = null;
        connectedUser = sock.user || { id: 'linked_device' };
        console.log('✅ [Paradise Bloom] WhatsApp Gateway Connected! Linked Phone:', connectedUser.id);
      }

      if (connection === 'close') {
        isConnected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`⚠️ [Paradise Bloom] WhatsApp connection closed. Code: ${statusCode}. Reconnecting: ${shouldReconnect}`);

        if (statusCode === DisconnectReason.loggedOut) {
          try {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          } catch {}
          connectedUser = null;
          latestQrDataUrl = null;
        }

        if (shouldReconnect) {
          setTimeout(connectToWhatsApp, 3000);
        }
      }
    });
  } catch (err) {
    console.error('[Paradise Bloom] Error in connectToWhatsApp:', err);
    setTimeout(connectToWhatsApp, 5000);
  } finally {
    isConnecting = false;
  }
}

// ── API ROUTES ────────────────────────────────────────────────────────

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Paradise Bloom WhatsApp Gateway',
    connected: isConnected,
    phone: connectedUser?.id ? connectedUser.id.split(':')[0] : null,
    time: new Date().toISOString()
  });
});

// Status
app.get('/status', (req, res) => {
  res.json({
    success: true,
    connected: isConnected,
    user: connectedUser,
    hasQr: !!latestQrDataUrl,
    phone: connectedUser?.id ? connectedUser.id.split(':')[0] : null
  });
});

// View QR Code (JSON or Interactive HTML)
app.get('/qr', (req, res) => {
  if (isConnected) {
    return res.json({
      success: true,
      connected: true,
      message: 'WhatsApp is already connected and active.',
      phone: connectedUser?.id ? connectedUser.id.split(':')[0] : null,
      qr: null,
      qrDataUrl: null
    });
  }

  if (req.query.format === 'html' || req.headers.accept?.includes('text/html')) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Paradise Bloom WhatsApp Gateway — Scan QR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b1411; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
          .card { background: #13221b; border: 1px solid rgba(22,163,74,0.3); border-radius: 20px; padding: 36px; text-align: center; max-width: 440px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
          h2 { margin: 0 0 10px; font-size: 1.5rem; letter-spacing: 1px; color: #22c55e; }
          p { color: #94a3b8; font-size: 0.9rem; line-height: 1.5; margin-bottom: 24px; }
          .qr-box { background: #fff; padding: 16px; border-radius: 14px; display: inline-block; margin-bottom: 20px; box-shadow: 0 0 30px rgba(34,197,94,0.25); }
          .qr-box img { width: 240px; height: 240px; display: block; }
          .instructions { text-align: left; background: rgba(255,255,255,0.05); border-radius: 12px; padding: 16px 20px; font-size: 0.85rem; color: #e2e8f0; }
          .instructions ol { margin: 0; padding-left: 20px; }
          .instructions li { margin-bottom: 6px; }
          .status-badge { display: inline-block; margin-top: 16px; padding: 6px 14px; border-radius: 20px; background: rgba(34,197,94,0.15); color: #22c55e; font-size: 0.8rem; font-weight: 700; }
        </style>
        <meta http-equiv="refresh" content="12">
      </head>
      <body>
        <div class="card">
          <h2>🌸 PARADISE BLOOM</h2>
          <p>Link your WhatsApp to send automated customer order confirmations, shipping updates, and abandoned cart recovery.</p>
          ${latestQrDataUrl ? `
            <div class="qr-box">
              <img src="${latestQrDataUrl}" alt="WhatsApp QR Code" />
            </div>
            <div class="instructions">
              <ol>
                <li>Open <strong>WhatsApp</strong> on your phone.</li>
                <li>Go to <strong>Settings</strong> &rarr; <strong>Linked Devices</strong>.</li>
                <li>Tap <strong>Link a Device</strong> and scan this QR code.</li>
              </ol>
            </div>
            <div class="status-badge">🔄 Auto-refreshing every 12 seconds</div>
          ` : `
            <p>⏳ Generating QR code... please wait a moment.</p>
          `}
        </div>
      </body>
      </html>
    `);
  }

  res.json({
    success: true,
    connected: false,
    qr: latestQrDataUrl,
    qrDataUrl: latestQrDataUrl
  });
});

// Generic Send Message (for order updates, cart recovery, announcements)
app.post('/send-message', async (req, res) => {
  const { phone, message, imageUrl, mediaUrl } = req.body;
  const targetImage = imageUrl || mediaUrl;

  if (!phone || (!message && !targetImage)) {
    return res.status(400).json({ success: false, message: 'Missing phone or message parameter.' });
  }

  if (!isConnected || !sock) {
    return res.status(503).json({ success: false, message: 'WhatsApp Gateway is not connected. Please scan QR code first.' });
  }

  try {
    const jid = formatJid(phone);
    if (targetImage) {
      try {
        await sock.sendMessage(jid, {
          image: { url: targetImage },
          caption: message || ''
        });
      } catch (imgErr) {
        console.warn('[Paradise Bloom] Image send failed, falling back to text:', imgErr.message);
        if (message) {
          await sock.sendMessage(jid, { text: message });
        } else {
          throw imgErr;
        }
      }
    } else {
      await sock.sendMessage(jid, { text: message });
    }
    res.json({ success: true, message: `Message sent to ${phone}`, jid });
  } catch (err) {
    console.error('[Paradise Bloom] Failed to send message:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Send OTP
app.post('/send-otp', async (req, res) => {
  const { phone, otp, name } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ success: false, message: 'Missing phone or otp parameter.' });
  }

  if (!isConnected || !sock) {
    return res.status(503).json({ success: false, message: 'WhatsApp Gateway is not connected.' });
  }

  try {
    const jid = formatJid(phone);
    const greeting = name ? `Assalamu Alaikum ${name}!` : 'Assalamu Alaikum!';
    const message = 
`🌸 *PARADISE BLOOM — A Gift of Faith & Love*

${greeting} Your verification passkey is:

🔑 *${otp}*

Valid for 5 minutes. Please do not share this code with anyone.

_Bespoke Islamic Keepsakes, Resin Quran Boxes & Nikah Hampers_`;

    const finalMessage = req.body.message || req.body.customMessage || message;
    await sock.sendMessage(jid, { text: finalMessage });

    res.json({
      success: true,
      message: `OTP sent successfully to ${phone}`,
      jid
    });
  } catch (err) {
    console.error('[Paradise Bloom] Failed to send OTP:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to send WhatsApp message.' });
  }
});

// Send Order Confirmation
app.post('/send-order', async (req, res) => {
  const { phone, orderId, customerName, total, items } = req.body;

  if (!phone || !orderId) {
    return res.status(400).json({ success: false, message: 'Missing phone or orderId.' });
  }

  if (!isConnected || !sock) {
    return res.status(503).json({ success: false, message: 'WhatsApp Gateway is not connected.' });
  }

  try {
    const jid = formatJid(phone);
    const greeting = customerName ? `Assalamu Alaikum ${customerName}!` : 'Assalamu Alaikum!';
    
    let itemsText = '';
    if (Array.isArray(items)) {
      itemsText = items.map(it => `• ${it.name || it.title} × ${it.quantity || 1}`).join('\n');
    }

    const message = 
`🌸 *PARADISE BLOOM — Order Confirmed*

${greeting} Thank you for your order! Your bespoke keepsake has entered atelier production.

📦 *Order ID:* #${orderId}
💰 *Total Amount:* ₹${Math.round(total || 0).toLocaleString('en-IN')}

${itemsText ? `🎁 *Included in Package:*\n${itemsText}\n\n` : ''}🚚 *Status:* In Atelier Production
Each keepsake is delicately handcrafted in our artisan workshop.

_If you need any personalization adjustments, simply reply directly to this chat._`;

    const finalMessage = req.body.message || req.body.customMessage || message;
    await sock.sendMessage(jid, { text: finalMessage });

    res.json({
      success: true,
      message: `Order confirmation sent to ${phone}`,
      jid
    });
  } catch (err) {
    console.error('[Paradise Bloom] Failed to send order confirmation:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to send WhatsApp message.' });
  }
});

// Logout / Disconnect
app.post('/logout', async (req, res) => {
  try {
    if (sock) {
      await sock.logout().catch(() => {});
    }
    try {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    } catch {}
    isConnected = false;
    connectedUser = null;
    latestQrDataUrl = null;
    setTimeout(connectToWhatsApp, 1000);
    res.json({ success: true, message: 'Logged out. Ready for new QR scan.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Start Express and connect Baileys
app.listen(PORT, () => {
  console.log(`🌸 Paradise Bloom WhatsApp Gateway running on port ${PORT}`);
  console.log(`📱 Scan QR code at: http://localhost:${PORT}/qr?format=html`);
  connectToWhatsApp();
});
