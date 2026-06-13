import { describe, expect, it } from 'vitest';
import {
  VAR_RISK_THRESHOLD,
  generateBriefing,
  type BriefingInput,
  type BriefingLine,
} from './briefing';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GENERATED_AT = '2026-06-13';

const EMPTY_INPUT: BriefingInput = {
  valueAtRisk30d: 0,
  products: [],
  expiringBatches: [],
  recentAnomalies: [],
};

function makeInput(overrides: Partial<BriefingInput>): BriefingInput {
  return { ...EMPTY_INPUT, ...overrides };
}

function linesForSection(lines: BriefingLine[], section: BriefingLine['section']): BriefingLine[] {
  return lines.filter((l) => l.section === section);
}

// ---------------------------------------------------------------------------
// Healthy state
// ---------------------------------------------------------------------------

describe('generateBriefing — healthy state', () => {
  it('returns a non-empty report with healthy=true when no rules fire', () => {
    const report = generateBriefing(EMPTY_INPUT, GENERATED_AT);
    expect(report.healthy).toBe(true);
    expect(report.lines).toHaveLength(1);
    expect(report.lines[0]!.section).toBe('Risks');
    expect(report.lines[0]!.text).toContain('All clear');
  });

  it('includes the VAR threshold and current value in the healthy-state text', () => {
    const report = generateBriefing(
      makeInput({ valueAtRisk30d: 1234 }),
      GENERATED_AT,
    );
    expect(report.healthy).toBe(true);
    expect(report.lines[0]!.text).toMatch(/1,234/);
  });

  it('stamps generatedAt on the report', () => {
    const report = generateBriefing(EMPTY_INPUT, GENERATED_AT);
    expect(report.generatedAt).toBe(GENERATED_AT);
  });
});

// ---------------------------------------------------------------------------
// Rule 1 — value at risk above threshold
// ---------------------------------------------------------------------------

describe('Rule 1 — expiry value at risk ≤30d', () => {
  const expiringBatches = [
    {
      productName: 'Amoxicillin 500mg',
      batchNumber: 'AMOX-0001',
      expiryDate: '2026-07-01',
      daysToExpiry: 18,
      lineValue: 8_000,
      coldChain: false,
    },
    {
      productName: 'Cefuroxime 500mg',
      batchNumber: 'CEFU-0001',
      expiryDate: '2026-07-10',
      daysToExpiry: 27,
      lineValue: 3_500,
      coldChain: false,
    },
  ];

  it('does not fire when value is at or below threshold', () => {
    const report = generateBriefing(
      makeInput({ valueAtRisk30d: VAR_RISK_THRESHOLD, expiringBatches }),
      GENERATED_AT,
    );
    expect(linesForSection(report.lines, 'Risks').some((l) => l.text.includes('Value at risk'))).toBe(false);
  });

  it('fires when value exceeds threshold, naming top batches', () => {
    const report = generateBriefing(
      makeInput({ valueAtRisk30d: 12_000, expiringBatches }),
      GENERATED_AT,
    );
    expect(report.healthy).toBe(false);
    const riskLines = linesForSection(report.lines, 'Risks');
    expect(riskLines.some((l) => l.text.includes('Value at risk'))).toBe(true);
    const riskText = riskLines.find((l) => l.text.includes('Value at risk'))!.text;
    expect(riskText).toContain('AMOX-0001');
    expect(riskText).toContain('CEFU-0001');
  });

  it('names at most 3 batches, sorted by descending value', () => {
    const batches = [
      { productName: 'A', batchNumber: 'B1', expiryDate: '2026-07-01', daysToExpiry: 10, lineValue: 1_000, coldChain: false },
      { productName: 'B', batchNumber: 'B2', expiryDate: '2026-07-02', daysToExpiry: 11, lineValue: 5_000, coldChain: false },
      { productName: 'C', batchNumber: 'B3', expiryDate: '2026-07-03', daysToExpiry: 12, lineValue: 3_000, coldChain: false },
      { productName: 'D', batchNumber: 'B4', expiryDate: '2026-07-04', daysToExpiry: 13, lineValue: 2_000, coldChain: false },
    ];
    const report = generateBriefing(
      makeInput({ valueAtRisk30d: 20_000, expiringBatches: batches }),
      GENERATED_AT,
    );
    const riskText = linesForSection(report.lines, 'Risks').find((l) => l.text.includes('Value at risk'))!.text;
    // Only top 3 by value: B2 (5k), B3 (3k), B4 (2k) — not B1 (1k)
    expect(riskText).toContain('B2');
    expect(riskText).toContain('B3');
    expect(riskText).toContain('B4');
    expect(riskText).not.toContain('B1');
  });

  it('only considers batches with daysToExpiry ≤ 30', () => {
    const batches = [
      { productName: 'Near', batchNumber: 'N1', expiryDate: '2026-07-01', daysToExpiry: 18, lineValue: 3_000, coldChain: false },
      { productName: 'Far', batchNumber: 'F1', expiryDate: '2026-09-01', daysToExpiry: 80, lineValue: 20_000, coldChain: false },
    ];
    const report = generateBriefing(
      makeInput({ valueAtRisk30d: 6_000, expiringBatches: batches }),
      GENERATED_AT,
    );
    const riskText = linesForSection(report.lines, 'Risks').find((l) => l.text.includes('Value at risk'))?.text ?? '';
    expect(riskText).toContain('N1');
    expect(riskText).not.toContain('F1');
  });
});

// ---------------------------------------------------------------------------
// Rule 2 — critical products
// ---------------------------------------------------------------------------

describe('Rule 2 — critical products', () => {
  const criticalProduct = {
    name: 'Losartan 50mg tabs',
    status: 'Critical' as const,
    coldChain: false,
    leadTimeDays: 30,
    suggestedOrderQty: 480,
  };

  it('does not fire when no products are critical', () => {
    const report = generateBriefing(
      makeInput({ products: [{ ...criticalProduct, status: 'OK' }] }),
      GENERATED_AT,
    );
    expect(linesForSection(report.lines, 'Actions').some((l) => l.text.includes('urgent'))).toBe(false);
  });

  it('fires one action line per critical product', () => {
    const report = generateBriefing(
      makeInput({ products: [criticalProduct, { ...criticalProduct, name: 'Budesonide inhaler' }] }),
      GENERATED_AT,
    );
    const urgentLines = linesForSection(report.lines, 'Actions').filter((l) =>
      l.text.includes('urgent'),
    );
    expect(urgentLines).toHaveLength(2);
  });

  it('interpolates product name, suggested qty, and lead time into the action text', () => {
    const report = generateBriefing(makeInput({ products: [criticalProduct] }), GENERATED_AT);
    const line = linesForSection(report.lines, 'Actions').find((l) => l.text.includes('urgent'))!;
    expect(line.text).toContain('Losartan 50mg tabs');
    expect(line.text).toContain('480');
    expect(line.text).toContain('30-day lead time');
  });
});

// ---------------------------------------------------------------------------
// Rule 3 — reorder products
// ---------------------------------------------------------------------------

describe('Rule 3 — reorder products', () => {
  const reorderProduct = {
    name: 'Bisoprolol 5mg tabs',
    status: 'Reorder' as const,
    coldChain: false,
    leadTimeDays: 21,
    suggestedOrderQty: 200,
  };

  it('does not fire when all products are OK', () => {
    const report = generateBriefing(
      makeInput({ products: [{ ...reorderProduct, status: 'OK' }] }),
      GENERATED_AT,
    );
    expect(linesForSection(report.lines, 'Actions').some((l) => l.text.includes('reorder'))).toBe(false);
  });

  it('groups all reorder products into one action line', () => {
    const r2 = { ...reorderProduct, name: 'Furosemide 40mg tabs' };
    const report = generateBriefing(makeInput({ products: [reorderProduct, r2] }), GENERATED_AT);
    const actionLines = linesForSection(report.lines, 'Actions');
    const reorderLine = actionLines.find((l) => l.text.includes('reorder'));
    expect(reorderLine).toBeDefined();
    expect(reorderLine!.text).toContain('Bisoprolol 5mg tabs');
    expect(reorderLine!.text).toContain('Furosemide 40mg tabs');
  });

  it('uses singular "product" for a single reorder item', () => {
    const report = generateBriefing(makeInput({ products: [reorderProduct] }), GENERATED_AT);
    const line = linesForSection(report.lines, 'Actions').find((l) => l.text.includes('reorder'))!;
    expect(line.text).toContain('1 product at');
  });

  it('uses plural "products" for multiple reorder items', () => {
    const report = generateBriefing(
      makeInput({ products: [reorderProduct, { ...reorderProduct, name: 'Other' }] }),
      GENERATED_AT,
    );
    const line = linesForSection(report.lines, 'Actions').find((l) => l.text.includes('reorder'))!;
    expect(line.text).toContain('2 products at');
  });
});

// ---------------------------------------------------------------------------
// Rule 4 — demand anomalies in last 14 days
// ---------------------------------------------------------------------------

describe('Rule 4 — recent demand anomalies', () => {
  it('does not fire when recentAnomalies is empty', () => {
    const report = generateBriefing(makeInput({ recentAnomalies: [] }), GENERATED_AT);
    expect(linesForSection(report.lines, 'Watchlist')).toHaveLength(0);
  });

  it('produces one watchlist line per anomaly with product name, z-score, and date', () => {
    const anomalies = [
      { productName: 'Amoxicillin 500mg caps', date: '2026-06-10', zScore: 4.2 },
      { productName: 'Atorvastatin 20mg tabs', date: '2026-06-06', zScore: 3.8 },
    ];
    const report = generateBriefing(makeInput({ recentAnomalies: anomalies }), GENERATED_AT);
    const watchlistLines = linesForSection(report.lines, 'Watchlist');
    expect(watchlistLines).toHaveLength(2);
    expect(watchlistLines[0]!.text).toContain('Amoxicillin 500mg caps');
    expect(watchlistLines[0]!.text).toContain('4.2σ');
    expect(watchlistLines[0]!.text).toContain('2026-06-10');
    expect(watchlistLines[1]!.text).toContain('3.8σ');
  });

  it('formats negative z-score as positive (absolute value)', () => {
    const anomalies = [{ productName: 'X', date: '2026-06-10', zScore: -3.1 }];
    const report = generateBriefing(makeInput({ recentAnomalies: anomalies }), GENERATED_AT);
    expect(linesForSection(report.lines, 'Watchlist')[0]!.text).toContain('3.1σ');
    expect(linesForSection(report.lines, 'Watchlist')[0]!.text).not.toContain('-3.1');
  });
});

// ---------------------------------------------------------------------------
// Rule 5 — cold-chain expiry ≤60d
// ---------------------------------------------------------------------------

describe('Rule 5 — cold-chain expiry', () => {
  const coldBatch = {
    productName: 'Influenza Quadrivalent injection',
    batchNumber: 'INFL-0002',
    expiryDate: '2026-07-25',
    daysToExpiry: 42,
    lineValue: 1_800,
    coldChain: true,
  };

  it('does not fire when no cold-chain batches expire ≤60d', () => {
    const warmBatch = { ...coldBatch, coldChain: false };
    const report = generateBriefing(makeInput({ expiringBatches: [warmBatch] }), GENERATED_AT);
    expect(linesForSection(report.lines, 'Risks').some((l) => l.text.includes('Cold-chain'))).toBe(false);
  });

  it('does not fire when cold-chain batch expires > 60d', () => {
    const farBatch = { ...coldBatch, daysToExpiry: 61 };
    const report = generateBriefing(makeInput({ expiringBatches: [farBatch] }), GENERATED_AT);
    expect(linesForSection(report.lines, 'Risks').some((l) => l.text.includes('Cold-chain'))).toBe(false);
  });

  it('fires when a cold-chain batch expires ≤60d, listing product and batch', () => {
    const report = generateBriefing(makeInput({ expiringBatches: [coldBatch] }), GENERATED_AT);
    const coldLines = linesForSection(report.lines, 'Risks').filter((l) =>
      l.text.includes('Cold-chain'),
    );
    expect(coldLines).toHaveLength(1);
    expect(coldLines[0]!.text).toContain('Influenza Quadrivalent injection');
    expect(coldLines[0]!.text).toContain('INFL-0002');
    expect(coldLines[0]!.text).toContain('42d');
  });

  it('includes exactly ≤60d batches (boundary = 60)', () => {
    const at60 = { ...coldBatch, daysToExpiry: 60 };
    const at61 = { ...coldBatch, batchNumber: 'INFL-0003', daysToExpiry: 61 };
    const report = generateBriefing(
      makeInput({ expiringBatches: [at60, at61] }),
      GENERATED_AT,
    );
    const coldText = linesForSection(report.lines, 'Risks').find((l) =>
      l.text.includes('Cold-chain'),
    )!.text;
    expect(coldText).toContain('INFL-0002');
    expect(coldText).not.toContain('INFL-0003');
  });
});

// ---------------------------------------------------------------------------
// Full snapshot — all rules firing simultaneously
// ---------------------------------------------------------------------------

describe('generateBriefing — full report snapshot', () => {
  const FULL_INPUT: BriefingInput = {
    valueAtRisk30d: 12_500,
    products: [
      {
        name: 'Losartan 50mg tabs',
        status: 'Critical',
        coldChain: false,
        leadTimeDays: 30,
        suggestedOrderQty: 480,
      },
      {
        name: 'Bisoprolol 5mg tabs',
        status: 'Reorder',
        coldChain: false,
        leadTimeDays: 21,
        suggestedOrderQty: 200,
      },
      {
        name: 'Furosemide 40mg tabs',
        status: 'Reorder',
        coldChain: false,
        leadTimeDays: 18,
        suggestedOrderQty: 150,
      },
    ],
    expiringBatches: [
      {
        productName: 'Amoxicillin 500mg caps',
        batchNumber: 'AMOX-0001',
        expiryDate: '2026-06-25',
        daysToExpiry: 12,
        lineValue: 6_200,
        coldChain: false,
      },
      {
        productName: 'Cefuroxime 500mg tabs',
        batchNumber: 'CEFU-0001',
        expiryDate: '2026-07-05',
        daysToExpiry: 22,
        lineValue: 3_800,
        coldChain: false,
      },
      {
        productName: 'Influenza Quadrivalent injection',
        batchNumber: 'INFL-0002',
        expiryDate: '2026-07-25',
        daysToExpiry: 42,
        lineValue: 2_100,
        coldChain: true,
      },
    ],
    recentAnomalies: [
      { productName: 'Amoxicillin 500mg caps', date: '2026-06-10', zScore: 4.2 },
      { productName: 'Atorvastatin 20mg tabs', date: '2026-06-06', zScore: 3.8 },
    ],
  };

  it('produces the expected full report (snapshot)', () => {
    const report = generateBriefing(FULL_INPUT, GENERATED_AT);
    expect(report).toMatchSnapshot();
  });

  it('is not healthy when rules fire', () => {
    const report = generateBriefing(FULL_INPUT, GENERATED_AT);
    expect(report.healthy).toBe(false);
  });

  it('produces lines in all three sections', () => {
    const report = generateBriefing(FULL_INPUT, GENERATED_AT);
    const sections = new Set(report.lines.map((l) => l.section));
    expect(sections.has('Risks')).toBe(true);
    expect(sections.has('Actions')).toBe(true);
    expect(sections.has('Watchlist')).toBe(true);
  });
});
