import { describe, expect, it } from 'vitest';
import { daysToExpiry, expiryBucket, fefoRank, valueAtRisk } from './expiry';
import type { RankableBatch, ValuedBatch } from './types';

// Fixed "today" for deterministic date math.
const ASOF = new Date('2026-06-12T09:30:00Z');

describe('daysToExpiry', () => {
  it('returns 0 when the batch expires today', () => {
    expect(daysToExpiry('2026-06-12', ASOF)).toBe(0);
  });

  it('returns a positive count for a future date', () => {
    expect(daysToExpiry('2026-06-22', ASOF)).toBe(10);
  });

  it('returns a negative count for an expired date', () => {
    expect(daysToExpiry('2026-06-02', ASOF)).toBe(-10);
  });

  it('ignores the time-of-day of asOf (whole-day based)', () => {
    expect(daysToExpiry('2026-06-13', new Date('2026-06-12T23:59:59Z'))).toBe(1);
  });

  it('crosses month and year boundaries correctly', () => {
    expect(daysToExpiry('2027-06-12', ASOF)).toBe(365);
  });
});

describe('expiryBucket', () => {
  it('classifies expired (days < 0)', () => {
    expect(expiryBucket(-1)).toBe('expired');
  });

  it('classifies the red window including today (0) and the 30-day edge', () => {
    expect(expiryBucket(0)).toBe('red');
    expect(expiryBucket(30)).toBe('red');
  });

  it('classifies the amber window at both edges (31 and 90)', () => {
    expect(expiryBucket(31)).toBe('amber');
    expect(expiryBucket(90)).toBe('amber');
  });

  it('classifies green beyond 90 days', () => {
    expect(expiryBucket(91)).toBe('green');
  });
});

describe('fefoRank', () => {
  const batches: RankableBatch[] = [
    { id: 'c', batchNumber: 'LOT-003', expiryDate: '2026-09-01' },
    { id: 'a', batchNumber: 'LOT-001', expiryDate: '2026-07-01' },
    { id: 'b', batchNumber: 'LOT-002', expiryDate: '2026-08-01' },
  ];

  it('ranks the earliest-expiring batch first', () => {
    const ranks = fefoRank(batches);
    expect(ranks.get('a')).toBe(1);
    expect(ranks.get('b')).toBe(2);
    expect(ranks.get('c')).toBe(3);
  });

  it('breaks ties on equal expiry by batch number (deterministic)', () => {
    const tied: RankableBatch[] = [
      { id: 'y', batchNumber: 'LOT-200', expiryDate: '2026-07-01' },
      { id: 'x', batchNumber: 'LOT-100', expiryDate: '2026-07-01' },
    ];
    const ranks = fefoRank(tied);
    expect(ranks.get('x')).toBe(1);
    expect(ranks.get('y')).toBe(2);
  });

  it('does not mutate the input array', () => {
    const input = [...batches];
    fefoRank(input);
    expect(input[0]?.id).toBe('c');
  });

  it('returns an empty map for no batches', () => {
    expect(fefoRank([]).size).toBe(0);
  });
});

describe('valueAtRisk', () => {
  const batches: ValuedBatch[] = [
    { quantity: 10, unitCost: 5, expiryDate: '2026-06-02' }, // expired (-10d)
    { quantity: 4, unitCost: 2.5, expiryDate: '2026-06-20' }, // +8d
    { quantity: 6, unitCost: 10, expiryDate: '2026-07-30' }, // +48d
    { quantity: 2, unitCost: 100, expiryDate: '2026-12-01' }, // far future
  ];

  it('includes expired and within-horizon stock for a 30-day horizon', () => {
    // expired 10×5=50  +  8d 4×2.5=10  = 60
    expect(valueAtRisk(batches, 30, ASOF)).toBe(60);
  });

  it('widens with the horizon (cumulative)', () => {
    // adds the +48d batch 6×10=60 → 120
    expect(valueAtRisk(batches, 60, ASOF)).toBe(120);
  });

  it('returns 0 for an empty batch list', () => {
    expect(valueAtRisk([], 90, ASOF)).toBe(0);
  });

  it('cleans floating-point noise by rounding to cents', () => {
    // 3 × 0.1 = 0.30000000000000004 in IEEE-754 → must come back as exactly 0.3.
    const odd: ValuedBatch[] = [{ quantity: 3, unitCost: 0.1, expiryDate: '2026-06-15' }];
    expect(valueAtRisk(odd, 30, ASOF)).toBe(0.3);
  });
});
