/**
 * Expiry & FEFO (First-Expired, First-Out) domain logic. Pure functions.
 *
 * Expiry windows (SPEC §F2):
 *   expired  days < 0
 *   red      0 ≤ days ≤ 30
 *   amber    31 ≤ days ≤ 90
 *   green    days > 90
 */
import type { ExpiryBucket, IsoDate, RankableBatch, ValuedBatch } from './types';

const MS_PER_DAY = 86_400_000;

/** Parse a `YYYY-MM-DD` date (the IsoDate contract) to a UTC-midnight Date. */
function parseIsoDateUtc(date: IsoDate): Date {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day));
}

/** Truncate any Date to UTC midnight, so comparisons are whole-day based. */
function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Whole days from `asOf` until `expiryDate`. Negative when already expired,
 * 0 when it expires today.
 */
export function daysToExpiry(expiryDate: IsoDate, asOf: Date): number {
  const diff = parseIsoDateUtc(expiryDate).getTime() - startOfUtcDay(asOf).getTime();
  return Math.round(diff / MS_PER_DAY);
}

/** Classify a days-to-expiry value into an expiry bucket. */
export function expiryBucket(days: number): ExpiryBucket {
  if (days < 0) return 'expired';
  if (days <= 30) return 'red';
  if (days <= 90) return 'amber';
  return 'green';
}

/**
 * FEFO consume order: rank 1 is the earliest-expiring batch. Ties (same expiry)
 * are broken by batch number so the ranking is deterministic.
 * Returns a map of batch id → rank.
 */
export function fefoRank(batches: readonly RankableBatch[]): Map<string, number> {
  const ordered = [...batches].sort(
    (a, b) =>
      a.expiryDate.localeCompare(b.expiryDate) || a.batchNumber.localeCompare(b.batchNumber),
  );
  const ranks = new Map<string, number>();
  ordered.forEach((batch, index) => ranks.set(batch.id, index + 1));
  return ranks;
}

/**
 * Value at risk: total cost (Σ quantity × unit cost) of all stock that is
 * already expired or will expire within `horizonDays`. Rounded to cents.
 */
export function valueAtRisk(
  batches: readonly ValuedBatch[],
  horizonDays: number,
  asOf: Date,
): number {
  const total = batches.reduce((sum, batch) => {
    const days = daysToExpiry(batch.expiryDate, asOf);
    return days <= horizonDays ? sum + batch.quantity * batch.unitCost : sum;
  }, 0);
  return Math.round(total * 100) / 100;
}
