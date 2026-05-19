import { TrendingUp, Target, Rocket, Shield } from 'lucide-react';

function StatCard({ label, value, sub, color, Icon }) {
  const colorMap = {
    blue: 'text-blue-400',
    green: 'text-emerald-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
  };
  return (
    <div className="flex-1 bg-[#0f1923] border border-[#1e2d40] rounded-xl p-4 flex items-center gap-4">
      <div className={`p-2 rounded-lg bg-[#1e2d40] ${colorMap[color]}`}>
        <Icon size={20} />
      </div>
      <div>
        <div className="text-xs text-gray-500 uppercase tracking-widest mb-0.5">{label}</div>
        <div className={`text-2xl font-bold font-mono ${colorMap[color]}`}>{value}</div>
        {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function StatsBar({ stats, totalPairs }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <StatCard label="Total Signals" value={stats?.totalSignals ?? 0} sub={`of ${totalPairs ?? '—'} pairs`} color="blue" Icon={TrendingUp} />
      <StatCard label="Overall Accuracy" value={`${stats?.accuracy ?? 0}%`} sub="Win / Loss" color="blue" Icon={Target} />
      <StatCard label="TP1 Win Rate" value={`${stats?.winRate ?? 0}%`} sub="hit rate TP1" color="green" Icon={Target} />
      <StatCard label="TP2 Hit Rate" value={`${stats?.tp2HitRate ?? 0}%`} sub="full target" color="yellow" Icon={Rocket} />
      <StatCard label="Stop Losses" value={stats?.stopLosses ?? 0} sub="SL triggered" color="red" Icon={Shield} />
    </div>
  );
}
