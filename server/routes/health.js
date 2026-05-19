import express from 'express';
import { getDB } from '../services/database.js';
import { binanceBreaker, geminiBreaker } from '../../lib/circuitBreaker.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const health = {
    status: 'ok',
    services: {
      database: { status: 'unknown', message: '' },
      binance: { status: 'unknown', message: '' },
      telegram: { status: 'unknown', message: '' },
      gemini: { status: 'unknown', message: '' }
    },
    circuitBreakers: {
      binance: binanceBreaker.getStatus(),
      gemini: geminiBreaker.getStatus()
    }
  };

  // 1. Check SQLite
  try {
    const db = getDB();
    const result = db.prepare('SELECT 1 as val').get();
    if (result.val === 1) {
      health.services.database = { status: 'connected', message: 'SQLite ready (WAL + NORMAL sync)' };
    }
  } catch (err) {
    health.status = 'degraded';
    health.services.database = { status: 'error', message: err.message };
  }

  // 2. Check Binance (also factor in circuit breaker state)
  const binanceCB = binanceBreaker.getStatus();
  if (binanceCB.state === 'OPEN') {
    health.status = 'degraded';
    health.services.binance = { status: 'error', message: `Circuit OPEN — ${binanceCB.lastError}` };
  } else {
    try {
      const start = Date.now();
      const binanceRes = await fetch('https://fapi.binance.com/fapi/v1/ping');
      if (binanceRes.ok) {
        health.services.binance = { status: 'connected', message: `${Date.now() - start}ms latency` };
      } else {
        health.status = 'degraded';
        health.services.binance = { status: 'error', message: `HTTP ${binanceRes.status}` };
      }
    } catch (err) {
      health.status = 'degraded';
      health.services.binance = { status: 'error', message: err.message };
    }
  }

  // 3. Check Telegram
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    health.services.telegram = { status: 'missing', message: 'No TELEGRAM_BOT_TOKEN' };
  } else {
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const tgData = await tgRes.json();
      if (tgData.ok) {
        health.services.telegram = { status: 'connected', message: `@${tgData.result.username}` };
      } else {
        health.status = 'degraded';
        health.services.telegram = { status: 'error', message: tgData.description };
      }
    } catch (err) {
      health.status = 'degraded';
      health.services.telegram = { status: 'error', message: err.message };
    }
  }

  // 4. Check Gemini (also factor in circuit breaker state)
  const geminiCB = geminiBreaker.getStatus();
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    health.services.gemini = { status: 'missing', message: 'No GEMINI_API_KEY' };
  } else if (geminiCB.state === 'OPEN') {
    health.status = 'degraded';
    health.services.gemini = { status: 'error', message: `Circuit OPEN — ${geminiCB.lastError}` };
  } else {
    health.services.gemini = { status: 'configured', message: 'Key configured' };
  }

  res.json(health);
});

export default router;
