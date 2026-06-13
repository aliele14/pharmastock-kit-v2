/**
 * Supply briefing rules engine (SPEC §F4).
 *
 * A typed rules table: each entry is a pure function that maps a BriefingInput
 * to zero or more BriefingLines. The engine evaluates every rule and assembles
 * the report. Given the same input the output is deterministic and
 * snapshot-testable.
 *
 * Never an empty report: if no rules fire, an explicit healthy-state summary
 * replaces the empty set.
 */
import type { IsoDate, StockStatus } from './types';

// ---------------------------------------------------------------------------
// Input types (plain data — assembled by the DB layer, not computed here)
// ---------------------------------------------------------------------------

export interface BriefingProduct {
  name: string;
  status: StockStatus;
  coldChain: boolean;
  leadTimeDays: number;
  suggestedOrderQty: number;
}

export interface BriefingBatch {
  productName: string;
  batchNumber: string;
  expiryDate: IsoDate;
  daysToExpiry: number;
  lineValue: number;
  coldChain: boolean;
}

export interface BriefingAnomaly {
  productName: string;
  date: IsoDate;
  zScore: number;
}

export interface BriefingInput {
  /** Σ(qty × unitCost) for future batches expiring within 30 days. */
  valueAtRisk30d: number;
  products: readonly BriefingProduct[];
  /** All batches ≤90 days to expiry (0 ≤ days ≤ 90), sorted by daysToExpiry. */
  expiringBatches: readonly BriefingBatch[];
  /** Anomaly points within the last 14 days (already filtered by the DB layer). */
  recentAnomalies: readonly BriefingAnomaly[];
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type BriefingSection = 'Risks' | 'Actions' | 'Watchlist';

export interface BriefingLine {
  section: BriefingSection;
  text: string;
}

export interface BriefingReport {
  generatedAt: IsoDate;
  lines: BriefingLine[];
  /** True when no rules fired (healthy-state message is still present in lines). */
  healthy: boolean;
}

// ---------------------------------------------------------------------------
// Rules table
// ---------------------------------------------------------------------------

/** Minimum total value at risk (€, ≤30d window) that triggers the risk line. */
export const VAR_RISK_THRESHOLD = 5_000;

type RuleFn = (input: BriefingInput) => BriefingLine[];

function fmtEur(n: number): string {
  return `€${Math.round(n).toLocaleString('en-IE')}`;
}

const RULES: readonly RuleFn[] = [
  // Rule 1 — value at risk ≤30d above threshold, naming top 3 batches by value
  (input) => {
    if (input.valueAtRisk30d <= VAR_RISK_THRESHOLD) return [];
    const top3 = [...input.expiringBatches]
      .filter((b) => b.daysToExpiry <= 30)
      .sort((a, b) => b.lineValue - a.lineValue)
      .slice(0, 3);
    if (top3.length === 0) return [];
    const batchList = top3
      .map((b) => `${b.productName} lot ${b.batchNumber} (${fmtEur(b.lineValue)})`)
      .join('; ');
    return [
      {
        section: 'Risks',
        text: `Value at risk ≤30 days: ${fmtEur(input.valueAtRisk30d)}. Highest-value batches: ${batchList}.`,
      },
    ];
  },

  // Rule 2 — critical-stock products (one action line each, with suggested order qty)
  (input) =>
    input.products
      .filter((p) => p.status === 'Critical')
      .map((p) => ({
        section: 'Actions' as BriefingSection,
        text: `Place urgent order for ${p.name}: ${p.suggestedOrderQty.toLocaleString('en-IE')} units suggested (${p.leadTimeDays}-day lead time, stock critically low).`,
      })),

  // Rule 3 — reorder-point products (grouped)
  (input) => {
    const reorder = input.products.filter((p) => p.status === 'Reorder');
    if (reorder.length === 0) return [];
    const s = reorder.length === 1 ? '' : 's';
    const names = reorder.map((p) => p.name).join(', ');
    return [
      {
        section: 'Actions',
        text: `Schedule reorder for ${reorder.length} product${s} at or below reorder point: ${names}.`,
      },
    ];
  },

  // Rule 4 — demand anomalies within the last 14 days
  (input) =>
    input.recentAnomalies.map((a) => ({
      section: 'Watchlist' as BriefingSection,
      text: `Demand for ${a.productName} spiked ${Math.abs(a.zScore).toFixed(1)}σ on ${a.date} — verify before next reorder.`,
    })),

  // Rule 5 — cold-chain batches expiring within 60 days
  (input) => {
    const cold = input.expiringBatches.filter((b) => b.coldChain && b.daysToExpiry <= 60);
    if (cold.length === 0) return [];
    const list = cold.map((b) => `${b.productName} lot ${b.batchNumber} (${b.daysToExpiry}d)`).join(', ');
    return [
      {
        section: 'Risks',
        text: `Cold-chain stock expiring within 60 days — prioritise dispensing or arrange return: ${list}.`,
      },
    ];
  },
];

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export function generateBriefing(input: BriefingInput, generatedAt: IsoDate): BriefingReport {
  const lines = RULES.flatMap((rule) => rule(input));
  const healthy = lines.length === 0;

  if (healthy) {
    lines.push({
      section: 'Risks',
      text:
        `All clear. No expiry value above the ${fmtEur(VAR_RISK_THRESHOLD)} threshold within 30 days ` +
        `(current value at risk: ${fmtEur(input.valueAtRisk30d)}), no products at critical or reorder status, ` +
        `no recent demand anomalies, and no cold-chain expiry concerns.`,
    });
  }

  return { generatedAt, lines, healthy };
}
