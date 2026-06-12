import { describe, expect, it } from 'vitest';
import {
  SERVICE_LEVEL_Z,
  demandStats,
  reorderPoint,
  safetyStock,
  stockStatus,
  suggestedOrderQty,
} from './reorder';

describe('demandStats', () => {
  it('computes mean and sample standard deviation', () => {
    const stats = demandStats([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(stats.count).toBe(8);
    expect(stats.mean).toBe(5);
    // sample stdDev (n-1) of this classic set ≈ 2.138
    expect(stats.stdDev).toBeCloseTo(2.13809, 4);
  });

  it('treats a single data point as zero variability', () => {
    expect(demandStats([42])).toEqual({ count: 1, mean: 42, stdDev: 0 });
  });

  it('returns all zeros for empty history', () => {
    expect(demandStats([])).toEqual({ count: 0, mean: 0, stdDev: 0 });
  });

  it('has zero std dev when all demand is identical (incl. all zeros)', () => {
    expect(demandStats([0, 0, 0, 0]).stdDev).toBe(0);
    expect(demandStats([3, 3, 3]).stdDev).toBe(0);
  });
});

describe('safetyStock', () => {
  it('applies SS = z × σd × √L with the default 95% z', () => {
    // 1.65 × 10 × √9 = 1.65 × 10 × 3 = 49.5
    expect(safetyStock(10, 9)).toBeCloseTo(49.5, 5);
    expect(SERVICE_LEVEL_Z).toBe(1.65);
  });

  it('is zero when demand has no variability', () => {
    expect(safetyStock(0, 9)).toBe(0);
  });

  it('is zero when lead time is zero', () => {
    expect(safetyStock(10, 0)).toBe(0);
  });

  it('accepts a custom z multiplier', () => {
    expect(safetyStock(10, 9, 2)).toBeCloseTo(60, 5);
  });
});

describe('reorderPoint', () => {
  it('applies ROP = d̄ × L + SS', () => {
    // 8 × 12 + 49.5 = 145.5
    expect(reorderPoint(8, 12, 49.5)).toBeCloseTo(145.5, 5);
  });

  it('equals lead-time demand when safety stock is zero', () => {
    expect(reorderPoint(5, 10, 0)).toBe(50);
  });
});

describe('stockStatus', () => {
  // ROP = 100, SS = 30 for these cases.
  it('flags Critical at or below safety stock', () => {
    expect(stockStatus(30, 100, 30)).toBe('Critical');
    expect(stockStatus(0, 100, 30)).toBe('Critical');
  });

  it('flags Reorder at or below the reorder point but above safety stock', () => {
    expect(stockStatus(100, 100, 30)).toBe('Reorder');
    expect(stockStatus(31, 100, 30)).toBe('Reorder');
  });

  it('is OK just above the reorder point', () => {
    expect(stockStatus(101, 100, 30)).toBe('OK');
  });
});

describe('suggestedOrderQty', () => {
  it('covers lead time + 30 days minus stock, rounded up to pack size', () => {
    // 8 × (12 + 30) − 100 = 236 → ceil to nearest 10 → 240
    expect(suggestedOrderQty(8, 12, 100, 10)).toBe(240);
  });

  it('rounds up to a custom pack size', () => {
    // 5 × (10 + 30) − 0 = 200 → already a multiple of 25
    expect(suggestedOrderQty(5, 10, 0, 25)).toBe(200);
    // 5 × 40 − 3 = 197 → ceil to 25 → 200
    expect(suggestedOrderQty(5, 10, 3, 25)).toBe(200);
  });

  it('is zero when stock already covers the horizon', () => {
    expect(suggestedOrderQty(8, 12, 1000)).toBe(0);
  });

  it('is zero for zero demand', () => {
    expect(suggestedOrderQty(0, 20, 0)).toBe(0);
  });

  it('defaults to a pack size of 10', () => {
    // 1 × (5 + 30) − 0 = 35 → ceil to 40
    expect(suggestedOrderQty(1, 5, 0)).toBe(40);
  });
});
