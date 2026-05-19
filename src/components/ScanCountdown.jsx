export default function ScanCountdown({ countdown, isScanning }) {
  const size = 52;
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const progress = isScanning ? 0 : (countdown / 60) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#1e2d40" strokeWidth="3" />
        <circle
          cx={size/2} cy={size/2} r={radius} fill="none"
          stroke={isScanning ? '#f59e0b' : '#00d4aa'}
          strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div className="absolute text-center">
        {isScanning ? (
          <span className="text-yellow-400 font-mono text-xs animate-pulse">…</span>
        ) : (
          <span className="text-[#00d4aa] font-mono text-xs font-bold">{countdown}s</span>
        )}
      </div>
    </div>
  );
}
