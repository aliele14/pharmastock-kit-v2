import { describe, expect, it } from 'vitest';
import { Z_THRESHOLD, MIN_DATAPOINTS, detectAnomalies, hasRecentAnomaly } from './anomalies';
import type { DemandPoint } from './types';

/** Build a DemandPoint array starting from `startDate`, one point per day. */
function makeSeries(qtys: number[], startDate = '2025-01-01'): DemandPoint[] {
  const startMs = new Date(startDate + 'T00:00:00Z').getTime();
  return qtys.map((qty, i) => ({
    date: new Date(startMs + i * 86_400_000).toISOString().slice(0, 10),
    qty,
  }));
}

// ---------------------------------------------------------------------------
// detectAnomalies
// ---------------------------------------------------------------------------

describe('detectAnomalies', () => {
  it('returns [] when fewer than MIN_DATAPOINTS are supplied', () => {
    expect(detectAnomalies(makeSeries(Array<number>(MIN_DATAPOINTS - 1).fill(10)))).toEqual([]);
  });

  it('detects anomaly on exactly MIN_DATAPOINTS (lower boundary is inclusive)', () => {
    // 13 values of 10, one spike → total 14 = MIN_DATAPOINTS → should detect
    const qtys = [...Array<number>(MIN_DATAPOINTS - 1).fill(10), 200];
    expect(detectAnomalies(makeSeries(qtys))).toHaveLength(1);
  });

  it('returns [] when σ = 0 (all demand identical)', () => {
    expect(detectAnomalies(makeSeries(Array<number>(20).fill(10)))).toEqual([]);
  });

  it('detects a clear positive spike', () => {
    // 19 × 10, one spike at 100 → z >> 2.5
    const qtys = [...Array<number>(19).fill(10), 100];
    const series = makeSeries(qtys);
    const anomalies = detectAnomalies(series);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]!.qty).toBe(100);
    expect(anomalies[0]!.zScore).toBeGreaterThan(Z_THRESHOLD);
  });

  it('detects a negative spike (sudden demand drop)', () => {
    // 19 × 50, one crash to 0
    const qtys = [...Array<number>(19).fill(50), 0];
    const series = makeSeries(qtys);
    const anomalies = detectAnomalies(series);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]!.zScore).toBeLessThan(-Z_THRESHOLD);
  });

  it('detects multiple spikes — mirrors the 4 seeded anomalies pattern', () => {
    // 86 normal days (28–32, cycling) + 4 spikes
    const qtys: number[] = Array.from({ length: 90 }, (_, i) => 28 + (i % 5));
    const spikeIndices = [3, 7, 10, 25];
    for (const idx of spikeIndices) qtys[idx] = 150;
    const series = makeSeries(qtys);
    const anomalies = detectAnomalies(series);
    expect(anomalies).toHaveLength(4);
    const anomalyDates = new Set(anomalies.map((a) => a.date));
    for (const idx of spikeIndices) {
      expect(anomalyDates.has(series[idx]!.date)).toBe(true);
    }
  });

  it('does not flag normal day-to-day fluctuation', () => {
    // Values tightly clustered around 30 (range 26–34) — z-scores well under 2.5
    const qtys = [30, 28, 32, 29, 31, 27, 33, 30, 29, 31, 28, 32, 30, 31, 29, 30, 28, 32, 29];
    expect(detectAnomalies(makeSeries(qtys))).toEqual([]);
  });

  it('preserves the correct date on each returned anomaly', () => {
    const qtys = Array<number>(20).fill(10);
    qtys[5] = 100;
    const series = makeSeries(qtys, '2026-03-01');
    const [anomaly] = detectAnomalies(series);
    // day index 5 from 2026-03-01 → 2026-03-06
    expect(anomaly?.date).toBe('2026-03-06');
  });

  it('z-score is computed with sample std dev (n − 1)', () => {
    // Controlled: 3 values [0, 10, 20] repeated to reach 15 points, plus one spike
    // Exact verification that the formula uses (n-1) denominator
    const base = [0, 10, 20, 0, 10, 20, 0, 10, 20, 0, 10, 20, 0, 10, 20];
    const series = makeSeries([...base, 200]);
    const anomalies = detectAnomalies(series);
    // Should detect the 200-spike
    expect(anomalies.some((a) => a.qty === 200)).toBe(true);
    // Manually verify: mean = (sum of base + 200) / 16
    const all = [...base, 200];
    const n = all.length;
    const mean = all.reduce((s, v) => s + v, 0) / n;
    const stdDev = Math.sqrt(all.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
    const expected = (200 - mean) / stdDev;
    const actual = anomalies.find((a) => a.qty === 200)!.zScore;
    expect(actual).toBeCloseTo(expected, 10);
  });
});

// ---------------------------------------------------------------------------
// hasRecentAnomaly
// ---------------------------------------------------------------------------

describe('hasRecentAnomaly', () => {
  it('returns false for an empty list', () => {
    expect(hasRecentAnomaly([], '2026-06-13')).toBe(false);
  });

  it('returns true when an anomaly falls within the window', () => {
    // 3 days ago is well within 14 days
    const anomalies = [{ date: '2026-06-10', qty: 100, zScore: 3.5 }];
    expect(hasRecentAnomaly(anomalies, '2026-06-13', 14)).toBe(true);
  });

  it('returns false when all anomalies are outside the window', () => {
    // 25 days ago — outside 14-day window
    const anomalies = [{ date: '2026-05-19', qty: 100, zScore: 3.5 }];
    expect(hasRecentAnomaly(anomalies, '2026-06-13', 14)).toBe(false);
  });

  it('includes the exact boundary day (first day of the window)', () => {
    // recentDays=14, asOf=2026-06-13 → window starts at 2026-05-31 (13 days before asOf)
    const onBoundary = [{ date: '2026-05-31', qty: 100, zScore: 3.5 }];
    expect(hasRecentAnomaly(onBoundary, '2026-06-13', 14)).toBe(true);
    const justOutside = [{ date: '2026-05-30', qty: 100, zScore: 3.5 }];
    expect(hasRecentAnomaly(justOutside, '2026-06-13', 14)).toBe(false);
  });

  it('handles the case where asOf itself contains an anomaly', () => {
    const anomalies = [{ date: '2026-06-13', qty: 100, zScore: 3.5 }];
    expect(hasRecentAnomaly(anomalies, '2026-06-13', 14)).toBe(true);
  });

  it('uses recentDays=14 by default', () => {
    // 14 days before 2026-06-13 = window starts 2026-05-31
    const inside = [{ date: '2026-06-01', qty: 100, zScore: 3.0 }];
    expect(hasRecentAnomaly(inside, '2026-06-13')).toBe(true);
  });

  it('returns true when at least one of several anomalies is recent', () => {
    const anomalies = [
      { date: '2026-04-01', qty: 100, zScore: 3.5 }, // old
      { date: '2026-06-12', qty: 150, zScore: 4.0 }, // recent
    ];
    expect(hasRecentAnomaly(anomalies, '2026-06-13', 14)).toBe(true);
  });

  it('excludes anomalies dated after asOfIso (upper bound)', () => {
    const anomalies = [{ date: '2026-06-20', qty: 100, zScore: 3.5 }];
    expect(hasRecentAnomaly(anomalies, '2026-06-13', 14)).toBe(false);
  });
});
