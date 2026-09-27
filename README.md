# 🌸 Paradise Bloom — Dedicated Baileys WhatsApp Gateway

Autonomous, zero-cost WhatsApp Web gateway built with Node.js and `@whiskeysockets/baileys`.
Operates completely independently from the Adakaar gateway with its own isolated credentials, session auth, and port (`3301`).

---

## 🚀 1. Running Locally on Your Mac

To start the gateway locally:
```bash
cd /Applications/XAMPP/xamppfiles/htdocs/paradisebloom/whatsapp-gateway
./start-gateway.sh
```
Or directly with Node:
```bash
PORT=3301 npm start
```

- **Health Check:** `http://localhost:3301/health`
- **Interactive Scan Screen:** `http://localhost:3301/qr?format=html`
- **Admin Dashboard Integration:** Set Gateway URL to `http://localhost:3301` in the Paradise Bloom Admin Control Panel.

---

## ☁️ 2. Deploying to Render.com (Free 24/7 Cloud Hosting)

If you want the gateway running on the cloud 24/7 without needing your laptop open:

1. Push this `whatsapp-gateway` folder to a new GitHub repository (e.g. `paradisebloom-whatsapp-gateway`).
2. Log into [Render.com](https://render.com) and click **New +** → **Web Service**.
3. Connect your repository.
4. Set:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** `Free`
5. Click **Create Web Service**.
6. Copy your generated Render URL (e.g. `https://paradisebloom-whatsapp-gateway.onrender.com`).
7. Paste this URL into **Paradise Bloom Admin** → **💬 WhatsApp Automation** → **Gateway Server URL** and click **Save URL**.

---

## 📲 3. Linking Your Device
1. Open WhatsApp on your mobile phone.
2. Go to **Settings** → **Linked Devices** → **Link a Device**.
3. Scan the QR code displayed in the Paradise Bloom Admin panel or at `http://localhost:3301/qr?format=html`.
