/**
 * Finds Support and Resistance zones from candle data.
 * @param {Array<{time, open, high, low, close, volume}>} candles
 * @returns {{ supports: Array, resistances: Array, nearestSupport: Object|null, nearestResistance: Object|null }}
 */
export function findSRZones(candles) {
  if (!candles || candles.length < 50) {
    return { supports: [], resistances: [], nearestSupport: null, nearestResistance: null };
  }

  const lookback = Math.min(candles.length, 100);
  const data = candles.slice(-lookback);
  const currentPrice = candles[candles.length - 1].close;

  const pivotHighs = [];
  const pivotLows = [];
  const leftBars = 5;
  const rightBars = 5;

  // Find swing highs and lows
  for (let i = leftBars; i < data.length - rightBars; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - leftBars; j <= i + rightBars; j++) {
      if (i === j) continue;
      if (data[j].high >= data[i].high) isHigh = false;
      if (data[j].low <= data[i].low) isLow = false;
    }
    if (isHigh) pivotHighs.push(data[i].high);
    if (isLow) pivotLows.push(data[i].low);
  }

  // Cluster algorithm (group within 0.3%)
  const clusterTolerance = 0.003; 

  function cluster(points) {
    const clusters = [];
    const sorted = [...points].sort((a, b) => b - a);

    for (const p of sorted) {
      let added = false;
      for (const c of clusters) {
        const avg = c.sum / c.count;
        if (Math.abs(p - avg) / avg <= clusterTolerance) {
          c.sum += p;
          c.count++;
          c.points.push(p);
          added = true;
          break;
        }
      }
      if (!added) {
        clusters.push({ sum: p, count: 1, points: [p] });
      }
    }

    return clusters.map(c => ({
      price: c.sum / c.count,
      touches: c.count,
      strength: Math.min(5, c.count) // max 5
    }));
  }

  const resistanceClusters = cluster(pivotHighs)
    .filter(c => c.price > currentPrice)
    .sort((a, b) => a.price - b.price); // closest first

  const supportClusters = cluster(pivotLows)
    .filter(c => c.price < currentPrice)
    .sort((a, b) => b.price - a.price); // closest first

  const supports = supportClusters.slice(0, 5).map(z => ({ ...z, type: 'support' }));
  const resistances = resistanceClusters.slice(0, 5).map(z => ({ ...z, type: 'resistance' }));

  return {
    supports,
    resistances,
    nearestSupport: supports.length > 0 ? supports[0] : null,
    nearestResistance: resistances.length > 0 ? resistances[0] : null
  };
}
