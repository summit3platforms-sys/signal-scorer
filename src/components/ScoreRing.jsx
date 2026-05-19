import { useEffect, useRef } from 'react';

/**
 * Animated SVG circular score ring.
 * Color: <50 red, 50-69 amber, 70-84 blue, 85+ emerald
 */
export default function ScoreRing({ score, size = 80 }) {
  const circleRef = useRef(null);
  const radius = (size / 2) - 8;
  const circumference = 2 * Math.PI * radius;

  const color =
    score >= 85 ? '#10b981' :
    score >= 70 ? '#3b82f6' :
    score >= 50 ? '#f59e0b' :
    '#ef4444';

  useEffect(() => {
    if (!circleRef.current) return;
    // Start at 0
    circleRef.current.style.strokeDashoffset = circumference;
    // Animate to target
    requestAnimationFrame(() => {
      const offset = circumference - (score / 100) * circumference;
      circleRef.current.style.transition = 'stroke-dashoffset 0.8s ease-out';
      circleRef.current.style.strokeDashoffset = offset;
    });
  }, [score, circumference]);

  return (
    <div className="flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#1e2d40" strokeWidth="6"
        />
        {/* Progress */}
        <circle
          ref={circleRef}
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
        />
      </svg>
      <div className="absolute flex flex-col items-center" style={{ lineHeight: 1 }}>
        <span className="font-mono font-bold text-white" style={{ fontSize: size * 0.22 }}>
          {score}
        </span>
        <span className="text-gray-500" style={{ fontSize: size * 0.12 }}>/ 100</span>
      </div>
    </div>
  );
}
