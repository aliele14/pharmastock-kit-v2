/**
 * Demand statistics & reorder intelligence. Pure functions (SPEC §F3).
 *
 *   safety stock   SS  = z × σd × √L           (z = 1.65 ≈ 95% service level)
 *   reorder point  ROP = d̄ × L + SS
 *   status              stock ≤ SS  → Critical
 *                       stock ≤ ROP → Reorder
 *                       otherwise   → OK
 *   suggested qty       d̄ × (L + 30) − stock   (floor 0, rounded up to pack size)
 */
import type { DemandStats, StockStatus } from './types';

/** z-multiplier for a ~95% service level (SPEC §F3). */
export const SERVICE_LEVEL_Z = 1.65;

/** Number of days of cover targeted by a suggested order, on top of lead time. */
const TARGET_COVER_DAYS = 30;

/**
 * Mean and sample standard deviation of a demand history window.
 * Empty history → all zeros; a single data point → stdDev 0 (no measurable
 * variability).
 */
export function demandStats(history: readonly number[]): DemandStats {
  const count = history.length;
  if (count === 0) return { count: 0, mean: 0, stdDev: 0 };

  const mean = history.reduce((sum, value) => sum + value, 0) / count;
  if (count < 2) return { count, mean, stdDev: 0 };

  const variance = history.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (count - 1);
  return { count, mean, stdDev: Math.sqrt(variance) };
}

/** Safety stock: SS = z × σd × √L. */
export function safetyStock(
  stdDevDemand: number,
  leadTimeDays: number,
  z: number = SERVICE_LEVEL_Z,
): number {
  if (leadTimeDays <= 0 || stdDevDemand <= 0) return 0;
  return z * stdDevDemand * Math.sqrt(leadTimeDays);
}

/** Reorder point: ROP = d̄ × L + SS. */
export function reorderPoint(meanDemand: number, leadTimeDays: number, safety: number): number {
  return meanDemand * leadTimeDays + safety;
}

/**
 * Stock status. Critical takes precedence over Reorder; since ROP ≥ SS, any
 * Critical stock level is also below ROP.
 */
export function stockStatus(stock: number, reorder: number, safety: number): StockStatus {
  if (stock <= safety) return 'Critical';
  if (stock <= reorder) return 'Reorder';
  return 'OK';
}

/**
 * Suggested order quantity to cover lead time plus a 30-day buffer:
 * d̄ × (L + 30) − stock, never negative, rounded up to a whole pack.
 */
export function suggestedOrderQty(
  meanDemand: number,
  leadTimeDays: number,
  stock: number,
  packSize = 10,
): number {
  const target = meanDemand * (leadTimeDays + TARGET_COVER_DAYS) - stock;
  if (target <= 0) return 0;
  return Math.ceil(target / packSize) * packSize;
}
