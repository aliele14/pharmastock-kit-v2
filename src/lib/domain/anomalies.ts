/**
 * Demand anomaly detection via z-score (SPEC §F5).
 *
 * |z| > Z_THRESHOLD flags a day as anomalous. z is computed against the whole
 * trailing window's mean and sample std dev (n − 1). Guard conditions:
 *   - fewer than MIN_DATAPOINTS → no detection (insufficient window)
 *   - σ = 0 (constant demand) → no anomalies possible (avoid division by zero)
 */
import type { AnomalyPoint, DemandPoint, IsoDate } from './types';

export const Z_THRESHOLD = 2.5;
export const MIN_DATAPOINTS = 14;

const MS_PER_DAY = 86_400_000;

/**
 * Detect anomalous demand points in `history`.
 * Returns only the flagged points (|z| > Z_THRESHOLD); empty array if none.
 */
export function detectAnomalies(history: readonly DemandPoint[]): AnomalyPoint[] {
  if (history.length < MIN_DATAPOINTS) return [];

  const qtys = history.map((h) => h.qty);
  const n = qtys.length;
  const mean = qtys.reduce((s, q) => s + q, 0) / n;

  const variance = qtys.reduce((s, q) => s + (q - mean) ** 2, 0) / (n - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return [];

  return history.reduce<AnomalyPoint[]>((acc, point) => {
    const zScore = (point.qty - mean) / stdDev;
    if (Math.abs(zScore) > Z_THRESHOLD) acc.push({ ...point, zScore });
    return acc;
  }, []);
}

/**
 * Returns true when at least one anomaly falls within the last `recentDays`
 * days of `asOfIso` (inclusive of both endpoints).
 */
export function hasRecentAnomaly(
  anomalies: readonly AnomalyPoint[],
  asOfIso: IsoDate,
  recentDays = 14,
): boolean {
  const asOfMs = new Date(asOfIso + 'T00:00:00Z').getTime();
  const cutoff = new Date(asOfMs - (recentDays - 1) * MS_PER_DAY).toISOString().slice(0, 10);
  return anomalies.some((a) => a.date >= cutoff && a.date <= asOfIso);
}
