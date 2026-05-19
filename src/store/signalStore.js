import { create } from 'zustand';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

function applyFilters(signals, filters) {
  let result = [...signals];
  if (filters.direction !== 'ALL') {
    result = result.filter(s => s.direction === filters.direction);
  }
  result = result.filter(s => s.score >= filters.minScore);
  return result;
}

export const useSignalStore = create((set, get) => ({
  signals: [],
  filteredSignals: [],
  tradeHistory: [],
  systemNotes: '',
  stats: { totalSignals: 0, winRate: 0, tp2HitRate: 0, stopLosses: 0 },
  filters: { direction: 'ALL', minScore: 60, timeframe: '15m' },
  prices: {},
  scanStatus: { isScanning: false, lastScanAt: null, totalPairs: 0, countdown: 300 },
  isConnected: false,
  socket: null,
  error: null,
  errorLogs: [],

  setFilter: (key, value) => {
    const newFilters = { ...get().filters, [key]: value };
    set({ filters: newFilters, filteredSignals: applyFilters(get().signals, newFilters) });
  },

  triggerScan: async () => {
    set(state => ({ scanStatus: { ...state.scanStatus, isScanning: true } }));
    try {
      const res = await fetch('/api/scan', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[Store] Scan trigger failed:', err);
      set({ error: err.message });
    } finally {
      set(state => ({ scanStatus: { ...state.scanStatus, isScanning: false } }));
    }
  },

  fetchHistory: async () => {
    try {
      const res = await fetch('/api/signals/history');
      if (res.ok) {
        const data = await res.json();
        set({ tradeHistory: data.history });
      }
    } catch (err) {
      console.error('[Store] Failed to fetch history:', err);
    }
  },

  engineSettings: {},

  fetchSystemNotes: async () => {
    try {
      const res = await fetch('/api/system-notes');
      const data = await res.json();
      if (res.ok) {
        set({ systemNotes: data.content });
      } else {
        set({ systemNotes: `Error 500: ${data.message || 'Unknown backend error'}\n\nPath being read was probably wrong.` });
      }
    } catch (err) {
      console.error('[Store] Failed to fetch system notes:', err);
      set({ systemNotes: `Error: Could not connect to backend. Please ensure 'npm run dev' is running.\n\nDetails: ${err.message}` });
    }
  },

  fetchSettings: async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const settings = await res.json();
        // Update both the engine settings and the UI filter default
        set({ 
          engineSettings: settings,
          filters: { ...get().filters, minScore: settings.minScore ?? 60 },
          // Apply filters to current active signals
          filteredSignals: applyFilters(get().signals, { ...get().filters, minScore: settings.minScore ?? 60 })
        });
      }
    } catch (err) {
      console.error('[Store] Failed to fetch settings:', err);
    }
  },

  updateSettings: async (newSettings) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      if (res.ok) {
        const data = await res.json();
        set({ engineSettings: data.settings });
      }
    } catch (err) {
      console.error('[Store] Failed to update settings:', err);
    }
  },

  fetchErrorLogs: async () => {
    try {
      const res = await fetch('/api/logs');
      if (res.ok) {
        const data = await res.json();
        set({ errorLogs: data.logs || [] });
      }
    } catch (err) {
      console.error('[Store] Failed to fetch error logs:', err);
    }
  },

  clearErrorLogs: async () => {
    try {
      const res = await fetch('/api/logs', { method: 'DELETE' });
      if (res.ok) {
        set({ errorLogs: [] });
      }
    } catch (err) {
      console.error('[Store] Failed to clear error logs:', err);
    }
  },

  triggerTestError: async () => {
    try {
      const res = await fetch('/api/logs/test', { method: 'POST' });
      if (res.ok) {
        get().fetchErrorLogs();
      }
    } catch (err) {
      console.error('[Store] Failed to trigger test error:', err);
    }
  },

  purgeAllData: async () => {
    try {
      const res = await fetch('/api/settings/purge', { method: 'POST' });
      if (res.ok) {
        set({
          signals: [],
          filteredSignals: [],
          tradeHistory: [],
          errorLogs: [],
          stats: { totalSignals: 0, winRate: 0, tp2HitRate: 0, stopLosses: 0, accuracy: 0 }
        });
        return true;
      } else {
        const errorText = await res.text();
        console.error('[Store] Purge API returned an error:', res.status, errorText);
      }
    } catch (err) {
      console.error('[Store] Purge failed:', err);
    }
    return false;
  },

  initSocket: () => {
    if (get().socket) return;

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });
    set({ socket });

    socket.on('connect', () => {
      set({ isConnected: true, error: null });
      console.log('[Socket] Connected:', socket.id);
      // Fetch dynamic database settings to align frontend filter
      get().fetchSettings();
      // Fetch system error logs initially
      get().fetchErrorLogs();
    });

    socket.on('disconnect', () => {
      set({ isConnected: false });
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
      set({ isConnected: false, error: 'Backend not reachable. Start the Express server.' });
    });

    socket.on('signals:update', ({ signals, scannedAt, totalPairs, stats }) => {
      const filters = get().filters;
      const filtered = applyFilters(signals || [], filters);
      set(state => ({
        signals: signals || [],
        filteredSignals: filtered,
        stats: stats || state.stats,
        scanStatus: {
          ...state.scanStatus,
          lastScanAt: scannedAt,
          totalPairs: totalPairs || state.scanStatus.totalPairs,
          isScanning: false,
          countdown: 300
        }
      }));
    });

    socket.on('scan:started', () => {
      set(state => ({ scanStatus: { ...state.scanStatus, isScanning: true, countdown: 300 } }));
    });

    socket.on('scan:progress', ({ scanned, total }) => {
      set(state => ({
        scanStatus: { ...state.scanStatus, isScanning: true, scanned, totalPairs: total }
      }));
    });

    socket.on('price:update', (priceMap) => {
      set({ prices: priceMap || {} });
    });

    socket.on('scan:error', ({ error }) => {
      console.error('[Socket] Scan error:', error);
      set(state => ({ scanStatus: { ...state.scanStatus, isScanning: false }, error }));
    });

    // Countdown timer (5-minute cycle)
    setInterval(() => {
      set(state => ({
        scanStatus: {
          ...state.scanStatus,
          countdown: state.scanStatus.countdown > 0 ? state.scanStatus.countdown - 1 : 300
        }
      }));
    }, 1000);
  }
}));
