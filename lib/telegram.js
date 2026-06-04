import { Telegraf } from 'telegraf';

let bot = null;
let chatIds = [];
const alertHistory = new Map(); // deduplication: symbol+direction -> timestamp

export function initBot(scanFunction, getSignalsFunction) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN missing. Bot disabled.');
    return;
  }

  const idsStr = process.env.TELEGRAM_CHAT_IDS;
  if (idsStr) {
    chatIds = idsStr.split(',').map(id => id.trim());
  }

  bot = new Telegraf(token);

  bot.start((ctx) => {
    ctx.reply(
      '⚡ *Signal Scorer Pro* bot initialized.\n\n' +
      'Commands:\n' +
      '/scan - Trigger a fresh market scan\n' +
      '/signals - List active signals\n' +
      '/top - Show top 3 signals with details\n' +
      '/filter long|short|all - Filter signals by direction\n' +
      '/status - Show scan status\n' +
      '/help - List commands',
      { parse_mode: 'Markdown' }
    );
  });

  bot.help((ctx) => {
    ctx.reply(
      'Commands:\n' +
      '/scan - Trigger a fresh market scan\n' +
      '/signals - List active signals (score ≥ 60)\n' +
      '/top - Show top 3 signals with full details\n' +
      '/filter long|short|all - Filter signals by direction\n' +
      '/status - Show scan status'
    );
  });

  bot.command('scan', async (ctx) => {
    ctx.reply('🔍 Starting full market scan...');
    try {
      const result = await scanFunction();
      if (!result || result.signals.length === 0) {
         return ctx.reply('✅ Scan complete. No actionable signals found.');
      }
      const top = result.signals.slice(0, 5);
      let msg = `✅ *Scan Complete*\nScanned ${result.totalPairs} pairs in ${Math.round(result.scanDurationMs / 1000)}s\n\n`;
      top.forEach((s, i) => {
        const icon = s.direction === 'LONG' ? '🔼' : '🔽';
        msg += `${i+1}. ${icon} ${s.symbol} [Score: ${s.score}]\n`;
      });
      ctx.reply(msg, { parse_mode: 'Markdown' });
    } catch (err) {
      ctx.reply('❌ Error during scan: ' + err.message);
    }
  });

  bot.command('status', (ctx) => {
    const stats = getSignalsFunction();
    if (!stats || !stats.meta) {
      return ctx.reply('No scan data available yet.');
    }
    const mins = Math.round((Date.now() - new Date(stats.meta.scannedAt).getTime()) / 60000);
    ctx.reply(
      `📊 *Status*\n` +
      `Last scan: ${mins} mins ago\n` +
      `Pairs scanned: ${stats.meta.totalPairs}\n` +
      `Active signals (≥60): ${stats.signals.length}`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('signals', (ctx) => {
    const data = getSignalsFunction({ minScore: 60 });
    if (!data.signals || data.signals.length === 0) {
      return ctx.reply('No active signals found.');
    }
    let msg = `🔥 *Active Signals* (${data.signals.length})\n\n`;
    data.signals.forEach(s => {
      msg += `${s.direction === 'LONG' ? '🟢' : '🔴'} ${s.symbol} [${s.score}]\n`;
    });
    ctx.reply(msg, { parse_mode: 'Markdown' });
  });

  bot.command('top', (ctx) => {
    const data = getSignalsFunction({ minScore: 70, limit: 3 });
    if (!data.signals || data.signals.length === 0) {
      return ctx.reply('No high confidence signals available.');
    }
    data.signals.forEach(s => {
      sendSingleAlertToChat(ctx.chat.id, s);
    });
  });

  bot.command('filter', (ctx) => {
    const arg = ctx.message.text.split(' ')[1]?.toUpperCase();
    if (!['LONG', 'SHORT', 'ALL'].includes(arg)) {
      return ctx.reply('Usage: /filter long|short|all');
    }
    const data = getSignalsFunction({ direction: arg === 'ALL' ? undefined : arg });
    ctx.reply(`Found ${data.signals.length} ${arg} signals.`);
  });

  // Always start polling — production uses long-polling (no webhook needed)
  console.log('[Telegram] Starting bot in polling mode...');
  bot.launch().catch(err => {
    console.warn('[Telegram] Bot launch failed (check your TELEGRAM_BOT_TOKEN):', err.message);
  });
}

export async function sendAlert(signalResult, force = false) {
  if (!bot || chatIds.length === 0) return;

  const key = signalResult.symbol;
  const lastAlert = alertHistory.get(key);
  // Deduplicate within 12 hours unless forced
  if (!force && lastAlert && (Date.now() - lastAlert) < 12 * 60 * 60 * 1000) {
    return;
  }
  
  alertHistory.set(key, Date.now());

  for (const chatId of chatIds) {
    await sendSingleAlertToChat(chatId, signalResult);
  }
}

// Escape characters that break Telegram HTML parse mode
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendSingleAlertToChat(chatId, s) {
  try {
    const icon = s.direction === 'LONG' ? '🔼 LONG' : '🔽 SHORT';
    const conf = s.confidence?.replace('_', ' ') ?? 'N/A';
    const formatPrice = (p) => {
      if (!p) return '—';
      return p < 1 ? p.toFixed(4) : p < 100 ? p.toFixed(3) : p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const calcPct = (target, entry, isLong) => {
      if (!target || !entry) return '';
      const diff = target - entry;
      let pct = (diff / entry) * 100;
      if (!isLong) {
        pct = -pct;
      }
      const sign = pct >= 0 ? '+' : '';
      return ` (${sign}${pct.toFixed(1)}%)`;
    };

    const isLong = s.direction === 'LONG';
    const tp1Pct = calcPct(s.tp1, s.entry, isLong);
    const tp2Pct = calcPct(s.tp2, s.entry, isLong);
    const slPct  = calcPct(s.stopLoss, s.entry, isLong);



    const regime = (s.regime ?? 'unknown').replace(/_/g, ' ');

    const msg =
`<b>${icon}  ${s.symbol}  [${s.score}/100]</b>
Confidence: <b>${conf}</b>  |  Regime: ${regime}
─────────────────────────
Entry:  <code>$${formatPrice(s.entry)}</code>
SL:     <code>$${formatPrice(s.stopLoss)}</code>${slPct}  🛑
TP1:    <code>$${formatPrice(s.tp1)}</code>${tp1Pct}  🎯
TP2:    <code>$${formatPrice(s.tp2)}</code>${tp2Pct}  🚀
R:R:    <code>${s.riskReward}x</code>
─────────────────────────
📊 Trend <b>${s.subScores?.trend?.score ?? 0}</b>  |  Momentum <b>${s.subScores?.momentum?.score ?? 0}</b>
📊 Volume <b>${s.subScores?.volume?.score ?? 0}</b>  |  Structure <b>${s.subScores?.structure?.score ?? 0}</b>
─────────────────────────
⚡ <b>Top reasons:</b>
${(s.reasons ?? []).slice(0, 3).map(r => `• ${r}`).join('\n')}`;

    await bot.telegram.sendMessage(chatId, msg, { parse_mode: 'HTML' });
  } catch (err) {
    console.error(`[Telegram] Failed to send alert to ${chatId}:`, err.message);
  }
}

export async function broadcastMessage(text) {
  if (!bot) return;
  for (const chatId of chatIds) {
    try {
      await bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML' });
    } catch(err) {
      console.error(`[Telegram] broadcastMessage failed for ${chatId}:`, err.message);
    }
  }
}

// ── Master-only notification (personal DM, not broadcast) ──────────────────
export async function sendTelegramToMaster(message) {
  if (!bot) return;
  const masterChatId = chatIds[0];
  if (!masterChatId) return;
  try {
    await bot.telegram.sendMessage(masterChatId.trim(), message, { parse_mode: 'HTML' });
  } catch(err) {
    console.error('[Telegram] sendTelegramToMaster failed:', err.message);
  }
}

// Ensure graceful stop
process.once('SIGINT', () => bot?.stop('SIGINT'));
process.once('SIGTERM', () => bot?.stop('SIGTERM'));
