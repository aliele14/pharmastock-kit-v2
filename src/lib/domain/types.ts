/**
 * Shared domain types for the supply-chain analytics layer.
 *
 * Everything here is plain data — no I/O, no framework types. The domain
 * functions that consume these are pure and fully unit-tested.
 */

/** A calendar date in `YYYY-MM-DD` form (matches Postgres `date` columns). */
export type IsoDate = string;

/** Expiry classification for a batch (SPEC §F2). */
export type ExpiryBucket = 'expired' | 'red' | 'amber' | 'green';

/** Reorder status for a product (SPEC §F3). */
export type StockStatus = 'OK' | 'Reorder' | 'Critical';

/** Minimal batch shape needed to compute FEFO consume order. */
export interface RankableBatch {
  id: string;
  batchNumber: string;
  expiryDate: IsoDate;
}

/** Minimal batch shape needed to compute value at risk. */
export interface ValuedBatch {
  quantity: number;
  unitCost: number;
  expiryDate: IsoDate;
}

/** Summary statistics over a demand history window. */
export interface DemandStats {
  count: number;
  mean: number;
  /** Sample standard deviation (n − 1); 0 when fewer than two data points. */
  stdDev: number;
}

/** A single day's demand with its date. */
export interface DemandPoint {
  date: IsoDate;
  qty: number;
}

/** A demand day flagged as anomalous (|z| > 2.5, SPEC §F5). */
export interface AnomalyPoint extends DemandPoint {
  zScore: number;
}
