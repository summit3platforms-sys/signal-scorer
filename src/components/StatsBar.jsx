import { TrendingUp, Target, Rocket, Shield, Activity } from 'lucide-react';

function StatCard({ label, value, sub, color, Icon }) {
  const colorMap = {
    blue: 'text-blue-400',
    green: 'text-emerald-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
  };
  return (
    <div className="flex-1 bg-[#0f1923] border border-[#1e2d40] rounded-xl p-3 sm:p-4 flex items-center gap-2 sm:gap-4">
      <div className={`hidden sm:flex p-2 rounded-lg bg-[#1e2d40] ${colorMap[color]}`}>
        <Icon size={20} />
      </div>
      <div>
        <div className="text-[9px] sm:text-xs text-gray-500 uppercase tracking-widest mb-0.5">{label}</div>
        <div className={`text-lg sm:text-2xl font-bold font-mono ${colorMap[color]}`}>{value}</div>
        {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function StatsBar({ stats, totalPairs, activeCount, isMaster }) {
  const expVal = stats?.expectancy ?? 0;
  const expectancyStr = expVal > 0 ? `+${expVal}%` : `${expVal}%`;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2 sm:gap-3">
      <StatCard label="Active Signals" value={activeCount ?? 0} sub="Currently open" color="green" Icon={Activity} />
      <StatCard label="Total Signals" value={stats?.totalSignals ?? 0} sub="SNDKUSDT only" color="blue" Icon={TrendingUp} />
      <StatCard
        label="Overall Accuracy"
        value={`${stats?.accuracy ?? 0}%`}
        sub={
          stats?.accuracyWindow === 'today'
            ? `Today · ${stats.sevenDayAccuracy ?? 0}% (7d)`
            : stats?.accuracyWindow === '7d'
            ? `7-Day Win Rate`
            : `30-Day Win Rate`
        }
        color="blue"
        Icon={Target}
      />
      <StatCard label="TP1 Hit Rate" value={`${stats?.tp1TouchRate ?? 0}%`} sub="hit rate TP1" color="green" Icon={Target} />
      <StatCard label="TP2 Hit Rate" value={`${stats?.tp2HitRate ?? 0}%`} sub="full target hit" color="yellow" Icon={Rocket} />
      <StatCard
        label="Stop Losses"
        value={stats?.stopLosses ?? 0}
        sub={isMaster && (stats?.invalidatedCount ?? 0) > 0
          ? `SL triggered · ${stats.invalidatedCount} invalidated`
          : 'SL triggered'
        }
        color="red"
        Icon={Shield}
      />
      <StatCard label="R Expectancy" value={expectancyStr} sub="avg profit / trade" color={expVal >= 0 ? 'green' : 'red'} Icon={TrendingUp} />
    </div>
  );
}
