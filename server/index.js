import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';

import scanRouter from './routes/scan.js';
import signalsRouter from './routes/signals.js';
import webhookRouter from './routes/webhook.js';
import settingsRouter from './routes/settings.js';
import healthRouter from './routes/health.js';
import telegramRouter from './routes/telegram.js';
import logsRouter from './routes/logs.js';

import { initCronJobs, runFullScan } from './cronJobs.js';
import { initBot } from '../lib/telegram.js';
import { getSignals } from './cache.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.set('io', io);
app.use(cors());
app.use(express.json());

// ── API Routes ────────────────────────────────────────────────────────────
app.use('/api/scan', scanRouter);
app.use('/api/signals', signalsRouter);
app.use('/api/webhook', webhookRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/health', healthRouter);
app.use('/api/telegram', telegramRouter);
app.use('/api/logs', logsRouter);
app.get('/api/meta', (_req, res) => res.json({ service: 'Signal Scorer Pro', version: '2.0.0' }));

app.get('/api/system-notes', (_req, res) => {
  try {
    const notesPath = join(__dirname, '..', 'project_system_notes.txt');
    if (existsSync(notesPath)) {
      const content = readFileSync(notesPath, 'utf-8');
      res.json({ content });
    } else {
      res.status(404).json({ error: 'System notes file not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to read notes', message: err.message });
  }
});

// ── Production: serve Vite build ──────────────────────────────────────────
if (isProd) {
  const distPath = join(__dirname, '..', 'dist');
  if (existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(join(distPath, 'index.html')));
    console.log('[Server] Serving static build from /dist');
  } else {
    console.warn('[Server] Production mode but /dist not found — run: npm run build');
  }
}

// ── Socket.io ─────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);
  // Push current state immediately on connect
  const data = getSignals();
  socket.emit('signals:update', {
    signals: data.signals,
    scannedAt: data.meta?.scannedAt,
    totalPairs: data.meta?.totalPairs,
    stats: data.stats
  });
  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// ── Boot ──────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`\n🚀 Signal Scorer Pro API running on http://localhost:${PORT}`);
  initBot(() => runFullScan(io), (filters) => getSignals(filters));
  initCronJobs(io);
});
