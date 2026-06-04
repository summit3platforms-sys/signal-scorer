import { create } from 'zustand';
import { io } from 'socket.io-client';
import { useAuthStore } from './authStore.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

function applyFilters(signals, filters) {
  let result = [...signals];
  if (filters.direction !== 'ALL') {
    result = result.filter(s => s.direction === filters.direction);
  }
  result = result.filter(s => s.score >= filters.minScore);
  
  if (filters.search && filters.search.trim() !== '') {
    const term = filters.search.toLowerCase().trim();
    result = result.filter(s => s.symbol.toLowerCase().includes(term));
  }
  
  return result;
}

export const useSignalStore = create((set, get) => ({
  signals: [],
  filteredSignals: [],
  tradeHistory: [],
  tradeHistoryTotal: 0,
  systemNotes: '',
  stats: { totalSignals: 0, accuracy: 0, tp1TouchRate: 0, tp2HitRate: 0, stopLosses: 0, expectancy: 0 },
  filters: { direction: 'ALL', minScore: 60, timeframe: '15m', search: '' },
  prices: {},
  scanStatus: { isScanning: false, lastScanAt: null, totalPairs: 0, countdown: 300, scanDurationMs: 0 },
  isConnected: false,
  socket: null,
  error: null,
  errorLogs: [],
  scannerLogs: [],

  setFilter: (key, value) => {
    const newFilters = { ...get().filters, [key]: value };
    set({ filters: newFilters, filteredSignals: applyFilters(get().signals, newFilters) });
  },

  triggerScan: async () => {
    set(state => ({ scanStatus: { ...state.scanStatus, isScanning: true } }));
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'x-user-id': useAuthStore.getState().user?.uniqueId || ''
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[Store] Scan trigger failed:', err);
      set({ error: err.message });
    } finally {
      set(state => ({ scanStatus: { ...state.scanStatus, isScanning: false } }));
    }
  },

  fetchHistory: async (limit = 50, offset = 0) => {
    try {
      const res = await fetch(`/api/signals/history?limit=${limit}&offset=${offset}`);
      if (res.ok) {
        const data = await res.json();
        set({ 
          tradeHistory: data.history,
          tradeHistoryTotal: data.total ?? data.history.length,
        });
      }
    } catch (err) {
      console.error('[Store] Failed to fetch history:', err);
    }
  },

  engineSettings: {},

  fetchSystemNotes: async () => {
    try {
      const res = await fetch('/api/system-notes', {
        headers: {
          'x-user-id': useAuthStore.getState().user?.uniqueId || ''
        }
      });
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
      const res = await fetch('/api/settings', {
        headers: {
          'x-user-id': useAuthStore.getState().user?.uniqueId || ''
        }
      });
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
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': useAuthStore.getState().user?.uniqueId || ''
        },
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
      const res = await fetch('/api/logs', {
        headers: {
          'x-user-id': useAuthStore.getState().user?.uniqueId || ''
        }
      });
      if (res.ok) {
        const data = await res.json();
        set({ errorLogs: data.logs || [] });
      }
    } catch (err) {
      console.error('[Store] Failed to fetch error logs:', err);
    }
  },

  fetchScannerLogs: async () => {
    try {
      const res = await fetch('/api/logs/scanner', {
        headers: {
          'x-user-id': useAuthStore.getState().user?.uniqueId || ''
        }
      });
      if (res.ok) {
        const data = await res.json();
        set({ scannerLogs: data.logs || [] });
      }
    } catch (err) {
      console.error('[Store] Failed to fetch scanner logs:', err);
    }
  },

  clearErrorLogs: async () => {
    try {
      const res = await fetch('/api/logs', {
        method: 'DELETE',
        headers: {
          'x-user-id': useAuthStore.getState().user?.uniqueId || ''
        }
      });
      if (res.ok) {
        set({ errorLogs: [] });
      }
    } catch (err) {
      console.error('[Store] Failed to clear error logs:', err);
    }
  },

  triggerTestError: async () => {
    try {
      const res = await fetch('/api/logs/test', {
        method: 'POST',
        headers: {
          'x-user-id': useAuthStore.getState().user?.uniqueId || ''
        }
      });
      if (res.ok) {
        get().fetchErrorLogs();
      }
    } catch (err) {
      console.error('[Store] Failed to trigger test error:', err);
    }
  },

  purgeAllData: async () => {
    try {
      const res = await fetch('/api/settings/purge', {
        method: 'POST',
        headers: {
          'x-user-id': useAuthStore.getState().user?.uniqueId || ''
        }
      });
      if (res.ok) {
        set({
          signals: [],
          filteredSignals: [],
          tradeHistory: [],
  tradeHistoryTotal: 0,
          errorLogs: [],
          scannerLogs: [],
          stats: { totalSignals: 0, accuracy: 0, tp1TouchRate: 0, tp2HitRate: 0, stopLosses: 0, expectancy: 0 }
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
      // Fetch scanner logs initially
      get().fetchScannerLogs();
    });

    socket.on('disconnect', () => {
      set({ isConnected: false });
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
      set({ isConnected: false, error: 'Backend not reachable. Start the Express server.' });
    });

    socket.on('signals:update', ({ signals, scannedAt, totalPairs, stats, meta }) => {
      const filters = get().filters;
      const filtered = applyFilters(signals || [], filters);
      // Fix 15: fire browser notification if new signals appeared
      const prevSymbols = new Set(get().signals.map(s => s.symbol));
      const newSignals = (signals || []).filter(s => !prevSymbols.has(s.symbol));
      if (newSignals.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
        const s = newSignals[0];
        new Notification(`⚡ New Signal: ${s.symbol}`, {
          body: `${s.direction} | Score ${s.score} | Entry $${s.entry}`,
          icon: '/favicon.svg',
          tag: `signal-${s.symbol}`,
        });
      }
      set(state => ({
        signals: signals || [],
        filteredSignals: filtered,
        stats: stats || state.stats,
        scanStatus: {
          ...state.scanStatus,
          lastScanAt: scannedAt,
          scanDurationMs: meta?.scanDurationMs || state.scanStatus.scanDurationMs || 0,
          totalPairs: totalPairs !== undefined && totalPairs !== null ? totalPairs : state.scanStatus.totalPairs,
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

    socket.on('scan:log', ({ message }) => {
      set(state => {
        const nextLogs = [...state.scannerLogs, message];
        return { scannerLogs: nextLogs.slice(-100) };
      });
    });

    socket.on('price:update', (priceMap) => {
      // Strip any non-price meta keys the server may have injected (e.g. __stale__)
      const clean = {};
      for (const [k, v] of Object.entries(priceMap || {})) {
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
          clean[k] = v;
        }
      }
      set({ prices: clean });
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
