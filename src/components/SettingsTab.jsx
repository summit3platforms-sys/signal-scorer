import { useState, useEffect } from 'react';
import { Save, RefreshCw, Sliders, CheckCircle, Trash2, AlertTriangle } from 'lucide-react';
import { useSignalStore } from '../store/signalStore.js';

export default function SettingsTab() {
  const { engineSettings, fetchSettings, updateSettings, purgeAllData } = useSignalStore();
  
  const [localSettings, setLocalSettings] = useState({
    emaAlignment: 0.25,
    rsiZone: 0.20,
    macdMomentum: 0.20,
    volumeSurge: 0.15,
    bollingerPos: 0.10,
    atrFilter: 0.10,
    minScore: 60,
    cooldownMinutes: 30,
    atrStopLoss: 2.0,
    atrTakeProfit1: 2.5,
    atrTakeProfit2: 4.5,
    capital: 1000,
    riskPct: 2,
    leverage: 5
  });

  const [isSaving, setIsSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [purgedMsg, setPurgedMsg] = useState(false);

  // Sync local state when global state loads
  useEffect(() => {
    if (Object.keys(engineSettings).length > 0) {
      setLocalSettings(engineSettings);
    } else {
      fetchSettings();
    }
  }, [engineSettings]);

  const handleChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: parseFloat(value) }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    await updateSettings(localSettings);
    setIsSaving(false);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 3000);
  };

  const handlePurge = async () => {
    if (!confirmPurge) {
      setConfirmPurge(true);
      // Auto-dismiss confirmation after 5 seconds
      setTimeout(() => setConfirmPurge(false), 5000);
      return;
    }
    setIsPurging(true);
    const success = await purgeAllData();
    setIsPurging(false);
    setConfirmPurge(false);
    if (success) {
      setPurgedMsg(true);
      setTimeout(() => setPurgedMsg(false), 4000);
    }
  };

  // Validate that weights equal exactly 1.00 (100%)
  const totalWeight = (
    localSettings.emaAlignment +
    localSettings.rsiZone +
    localSettings.macdMomentum +
    localSettings.volumeSurge +
    localSettings.bollingerPos +
    localSettings.atrFilter
  ).toFixed(2);

  const isWeightValid = parseFloat(totalWeight) === 1.00;

  return (
    <div className="bg-[#0f1923] border border-[#1e2d40] rounded-xl p-6 animate-fadeSlide max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Sliders className="text-[#00d4aa]" /> AI Engine Parameters
        </h2>
        <div className="flex items-center gap-4">
          <span className={`text-sm font-mono font-bold ${isWeightValid ? 'text-emerald-400' : 'text-red-400'}`}>
            Total Weight: {(parseFloat(totalWeight) * 100).toFixed(0)}%
          </span>
          <button
            onClick={handleSave}
            disabled={!isWeightValid || isSaving}
            className="flex items-center gap-2 bg-[#00d4aa] text-black px-4 py-2 rounded-lg font-bold hover:bg-[#00b38f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <RefreshCw className="animate-spin" size={16} /> : savedMsg ? <CheckCircle size={16} /> : <Save size={16} />}
            {savedMsg ? 'Saved!' : 'Save Engine Config'}
          </button>
        </div>
      </div>

      {!isWeightValid && (
        <div className="bg-red-500/20 text-red-400 border border-red-500/30 p-4 rounded-lg text-sm">
          <strong>Warning:</strong> The sum of all weights must be exactly 100%. Please adjust the sliders before saving.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Weights */}
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-gray-300 border-b border-[#1e2d40] pb-2">Scoring Weights</h3>
          
          <WeightSlider label="EMA Alignment (Trend)" valKey="emaAlignment" value={localSettings.emaAlignment} onChange={handleChange} />
          <WeightSlider label="RSI Zone (Momentum)" valKey="rsiZone" value={localSettings.rsiZone} onChange={handleChange} />
          <WeightSlider label="MACD Momentum" valKey="macdMomentum" value={localSettings.macdMomentum} onChange={handleChange} />
          <WeightSlider label="Volume Surge" valKey="volumeSurge" value={localSettings.volumeSurge} onChange={handleChange} />
          <WeightSlider label="Bollinger Position" valKey="bollingerPos" value={localSettings.bollingerPos} onChange={handleChange} />
          <WeightSlider label="ATR Filter (Volatility)" valKey="atrFilter" value={localSettings.atrFilter} onChange={handleChange} />
        </div>

        {/* Right Column: General Thresholds */}
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-gray-300 border-b border-[#1e2d40] pb-2">Engine Settings & Cooldowns</h3>
          
          {/* Min Score */}
          <div className="bg-[#1e2d40]/40 p-4 rounded-lg border border-[#1e2d40]">
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">Minimum Signal Score</label>
              <span className="text-sm font-bold text-[#00d4aa]">{localSettings.minScore} / 100</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={localSettings.minScore}
              onChange={(e) => handleChange('minScore', e.target.value)}
              className="w-full accent-[#00d4aa]"
            />
            <p className="text-xs text-gray-500 mt-2">
              Only signals scoring above this threshold will be tracked, saved, and alerted.
            </p>
          </div>

          {/* Cooldown minutes */}
          <div className="bg-[#1e2d40]/40 p-4 rounded-lg border border-[#1e2d40]">
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">Signal Cooldown Period</label>
              <span className="text-sm font-bold text-[#00d4aa]">{localSettings.cooldownMinutes ?? 30} mins</span>
            </div>
            <input
              type="range"
              min="5"
              max="720"
              step="5"
              value={localSettings.cooldownMinutes ?? 30}
              onChange={(e) => handleChange('cooldownMinutes', e.target.value)}
              className="w-full accent-[#00d4aa]"
            />
            <p className="text-xs text-gray-500 mt-2">
              Prevents duplicate signals for the same trading pair from re-firing within this timeframe.
            </p>
          </div>

          {/* ATR Stop Loss multiplier */}
          <div className="bg-[#1e2d40]/40 p-4 rounded-lg border border-[#1e2d40]">
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">ATR Stop Loss Multiplier</label>
              <span className="text-sm font-bold text-[#00d4aa]">{localSettings.atrStopLoss ?? 2.0}x ATR</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.1"
              value={localSettings.atrStopLoss ?? 2.0}
              onChange={(e) => handleChange('atrStopLoss', e.target.value)}
              className="w-full accent-[#00d4aa]"
            />
            <p className="text-xs text-gray-500 mt-2">
              Width of the stop-loss level computed relative to Average True Range volatility.
            </p>
          </div>

          {/* ATR TP1 multiplier */}
          <div className="bg-[#1e2d40]/40 p-4 rounded-lg border border-[#1e2d40]">
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">ATR Take Profit 1 Multiplier</label>
              <span className="text-sm font-bold text-[#00d4aa]">{localSettings.atrTakeProfit1 ?? 2.5}x ATR</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="10.0"
              step="0.1"
              value={localSettings.atrTakeProfit1 ?? 2.5}
              onChange={(e) => handleChange('atrTakeProfit1', e.target.value)}
              className="w-full accent-[#00d4aa]"
            />
            <p className="text-xs text-gray-500 mt-2">
              Distance to Take Profit Target 1 (triggers half-exit and breakeven SL adjust).
            </p>
          </div>

          {/* ATR TP2 multiplier */}
          <div className="bg-[#1e2d40]/40 p-4 rounded-lg border border-[#1e2d40]">
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">ATR Take Profit 2 Multiplier</label>
              <span className="text-sm font-bold text-[#00d4aa]">{localSettings.atrTakeProfit2 ?? 4.5}x ATR</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="15.0"
              step="0.1"
              value={localSettings.atrTakeProfit2 ?? 4.5}
              onChange={(e) => handleChange('atrTakeProfit2', e.target.value)}
              className="w-full accent-[#00d4aa]"
            />
            <p className="text-xs text-gray-500 mt-2">
              Distance to final Take Profit Target 2 (closes signal completely).
            </p>
          </div>

          {/* ── Position Sizing Settings ──────────────────────────────── */}
          <h3 className="text-lg font-bold text-gray-300 border-b border-[#1e2d40] pb-2 mt-4">Position Sizing</h3>

          {/* Capital */}
          <div className="bg-[#1e2d40]/40 p-4 rounded-lg border border-[#1e2d40]">
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">Capital (USDT)</label>
              <span className="text-sm font-bold text-[#00d4aa]">${localSettings.capital ?? 1000}</span>
            </div>
            <input type="range" min="100" max="100000" step="100"
              value={localSettings.capital ?? 1000}
              onChange={(e) => handleChange('capital', e.target.value)}
              className="w-full accent-[#00d4aa]" />
            <p className="text-xs text-gray-500 mt-2">Your total trading capital in USDT. Used to calculate position sizes.</p>
          </div>

          {/* Risk per trade */}
          <div className="bg-[#1e2d40]/40 p-4 rounded-lg border border-[#1e2d40]">
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">Risk Per Trade</label>
              <span className="text-sm font-bold text-[#00d4aa]">{localSettings.riskPct ?? 2}%</span>
            </div>
            <input type="range" min="0.5" max="10" step="0.5"
              value={localSettings.riskPct ?? 2}
              onChange={(e) => handleChange('riskPct', e.target.value)}
              className="w-full accent-[#00d4aa]" />
            <p className="text-xs text-gray-500 mt-2">Percentage of capital risked per signal. 1-2% is institutional standard.</p>
          </div>

          {/* Leverage */}
          <div className="bg-[#1e2d40]/40 p-4 rounded-lg border border-[#1e2d40]">
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">Leverage</label>
              <span className="text-sm font-bold text-[#00d4aa]">{localSettings.leverage ?? 5}×</span>
            </div>
            <input type="range" min="1" max="20" step="1"
              value={localSettings.leverage ?? 5}
              onChange={(e) => handleChange('leverage', e.target.value)}
              className="w-full accent-[#00d4aa]" />
            <p className="text-xs text-gray-500 mt-2">Leverage multiplier. Higher leverage = larger position but higher liquidation risk.</p>
          </div>
        </div>
      </div>

      {/* ── Danger Zone ───────────────────────────────────────────────── */}
      <div className="border border-red-500/30 rounded-xl p-5 bg-red-500/5 mt-4">
        <h3 className="text-lg font-bold text-red-400 flex items-center gap-2 mb-3">
          <AlertTriangle size={20} /> Danger Zone
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Permanently erase <strong className="text-white">all signals, trade history, and error logs</strong> from the database. 
          Engine settings (weights & thresholds) will be preserved. This action cannot be undone.
        </p>
        <button
          onClick={handlePurge}
          disabled={isPurging}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold transition-all duration-200 ${
            confirmPurge
              ? 'bg-red-600 text-white hover:bg-red-700 ring-2 ring-red-400 animate-pulse'
              : purgedMsg
              ? 'bg-emerald-600 text-white'
              : 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isPurging ? (
            <><RefreshCw className="animate-spin" size={16} /> Purging...</>
          ) : purgedMsg ? (
            <><CheckCircle size={16} /> All Data Purged!</>
          ) : confirmPurge ? (
            <><Trash2 size={16} /> Click Again to Confirm — This is Irreversible</>
          ) : (
            <><Trash2 size={16} /> Purge All Data</>
          )}
        </button>
      </div>
    </div>
  );
}

function WeightSlider({ label, valKey, value, onChange }) {
  return (
    <div className="bg-[#1e2d40]/20 p-3 rounded-lg border border-[#1e2d40]/50 hover:bg-[#1e2d40]/40 transition-colors">
      <div className="flex justify-between mb-2">
        <label className="text-sm font-medium text-gray-300">{label}</label>
        <span className="text-sm font-mono text-[#00d4aa]">{(value * 100).toFixed(0)}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={value}
        onChange={(e) => onChange(valKey, e.target.value)}
        className="w-full accent-[#00d4aa]"
      />
    </div>
  );
}
