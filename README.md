# Signal Scorer Pro

Real-time Binance USDT Futures signal scanner with AI scoring, WebSocket live feeds, and Telegram alerts.

## Tech Stack
- **Backend**: Node.js 20 + Express 4 + Socket.io 4
- **Frontend**: Vite 5 + React 18 + TailwindCSS 3
- **AI**: Google Gemini (`gemini-1.5-flash`) via `@google/generative-ai`
- **Exchange**: Binance USDT Perpetual Futures (public REST API — no auth required)
- **Telegram**: `telegraf 4.x` (polling in dev, webhook in production)

---

## Quick Start (Development)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your real API keys

# 3. Start dev server (Express + Vite concurrently)
npm run dev
```

Frontend: http://localhost:5174  
Backend API: http://localhost:3000

---

## Production Deployment (VPS / Cloud Server)

### Step 1: Server Requirements
- Node.js 20+
- A domain or IP address
- `git` installed on the server

### Step 2: Clone & Install
```bash
git clone https://github.com/yourusername/signal-scorer-pro.git
cd signal-scorer-pro
npm install
```

### Step 3: Configure Environment
```bash
cp .env.example .env
nano .env   # Fill in all values
```

### Step 4: Build the Frontend
```bash
npm run build
# This generates /dist folder served by Express in production
```

### Step 5: Run in Production (with PM2)
```bash
npm install -g pm2
NODE_ENV=production pm2 start server/index.js --name signal-scorer-pro
pm2 save
pm2 startup   # Auto-start on server reboot
```

### Step 6: Nginx Reverse Proxy (Optional but recommended)
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Then add SSL with Certbot: `sudo certbot --nginx -d yourdomain.com`

### Step 7: Telegram Webhook (Production Only)
Set your webhook URL after deploying:
```bash
curl "https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=https://yourdomain.com/api/webhook"
```
The bot automatically switches from polling → webhook when `NODE_ENV=production`.

---

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `NODE_ENV` | `development` or `production` | ✅ |
| `PORT` | Express server port (default: 3000) | ✅ |
| `GEMINI_API_KEY` | Google Gemini API key | Optional |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather | Optional |
| `TELEGRAM_CHAT_IDS` | Comma-separated chat/channel IDs | Optional |
| `VITE_SOCKET_URL` | In dev: `http://localhost:3000`. In prod: leave empty | ✅ |

---

## Telegram Setup

1. **Create a bot** via `@BotFather` on Telegram → get the bot token
2. **Create a channel** → add your bot as Admin
3. **Get the channel ID**:
   - Public channel: use `@channelname`
   - Private channel: forward a message to `@userinfobot` to get the numeric ID
4. Add to `.env`: `TELEGRAM_CHAT_IDS=@channelname` or `-1001234567890`
5. Bot commands: `/scan`, `/signals`, `/top`, `/status`, `/help`

---

## Binance Integration

Uses **public** Binance Futures REST API — **no API key required** for market data.

- `GET /fapi/v1/exchangeInfo` — fetch all USDT perpetual pairs
- `GET /fapi/v1/klines` — candlestick data (15m and 1h)
- `GET /fapi/v1/ticker/24hr` — live prices, 24h change, volume

Rate limits are handled automatically with a concurrency limiter (max 10 parallel requests) and exponential backoff retry (1s → 2s → 4s).

---

## Signal Scoring

See [`signal-engine/README.md`](signal-engine/README.md) for full documentation on the 5-factor scoring system.
