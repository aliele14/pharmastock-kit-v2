import 'server-only';
import {
  daysToExpiry,
  demandStats,
  detectAnomalies,
  expiryBucket,
  fefoRank,
  hasRecentAnomaly,
  reorderPoint,
  safetyStock,
  stockStatus,
  suggestedOrderQty,
  valueAtRisk,
  type AnomalyPoint,
  type BriefingAnomaly,
  type BriefingBatch,
  type BriefingInput,
  type BriefingProduct,
  type DemandPoint,
} from '@/lib/domain';
import { getServerSupabase } from './client';
import type {
  BatchRow,
  BatchView,
  DemandRow,
  ExpiringBatchView,
  ExpiryRisk,
  ProductMetrics,
  ProductRow,
  SupplierRow,
} from './types';

const EXPIRY_HORIZONS = [30, 60, 90] as const;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Low-level fetchers — each throws a user-facing message on DB error.
//
// PostgREST caps a single response at 1000 rows, so every read is paginated
// with .range() over a stable .order() to avoid truncation (demand_history
// alone is ~3600 rows).
// ---------------------------------------------------------------------------
const PAGE_SIZE = 1000;

async function selectAll<T>(
  table: string,
  columns: string,
  orderBy: string,
  filter?: { column: string; value: string },
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = getServerSupabase().from(table).select(columns);
    if (filter) query = query.eq(filter.column, filter.value);

    const { data, error } = await query
      .order(orderBy, { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Could not load ${table}: ${error.message}`);

    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

function fetchSuppliers(): Promise<SupplierRow[]> {
  return selectAll<SupplierRow>('suppliers', '*', 'name');
}

function fetchProducts(): Promise<ProductRow[]> {
  return selectAll<ProductRow>('products', '*', 'name');
}

function fetchBatches(productId?: string): Promise<BatchRow[]> {
  return selectAll<BatchRow>(
    'batches',
    '*',
    'expiry_date',
    productId ? { column: 'product_id', value: productId } : undefined,
  );
}

function fetchDemand(productId?: string): Promise<DemandRow[]> {
  return selectAll<DemandRow>(
    'demand_history',
    'product_id, date, qty',
    'date',
    productId ? { column: 'product_id', value: productId } : undefined,
  );
}

// ---------------------------------------------------------------------------
// Composition helpers (group rows, then apply the domain layer).
// ---------------------------------------------------------------------------
function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = map.get(k);
    if (bucket) bucket.push(row);
    else map.set(k, [row]);
  }
  return map;
}

function computeMetrics(
  product: ProductRow,
  supplier: SupplierRow | undefined,
  batches: readonly BatchRow[],
  demandQtys: readonly number[],
): ProductMetrics {
  const leadTimeDays = supplier?.lead_time_days ?? 0;
  const totalStock = batches.reduce((sum, b) => sum + b.quantity, 0);
  const stats = demandStats(demandQtys);
  const safety = safetyStock(stats.stdDev, leadTimeDays);
  const rop = reorderPoint(stats.mean, leadTimeDays, safety);

  return {
    id: product.id,
    name: product.name,
    category: product.category,
    unitCost: product.unit_cost,
    packSize: product.pack_size,
    coldChain: product.cold_chain,
    supplierName: supplier?.name ?? 'Unknown supplier',
    leadTimeDays,
    totalStock,
    status: stockStatus(totalStock, rop, safety),
    meanDemand: round2(stats.mean),
    stdDevDemand: round2(stats.stdDev),
    safetyStock: round2(safety),
    reorderPoint: round2(rop),
    suggestedOrderQty: suggestedOrderQty(stats.mean, leadTimeDays, totalStock, product.pack_size),
    // Phase 2 fields are added by the caller after anomaly detection
    hasAnomaly: false,
    minDaysToExpiry: 9999,
    valueAtRisk30d: 0,
  };
}

function toBatchViews(batches: readonly BatchRow[], unitCost: number, asOf: Date): BatchView[] {
  const ranks = fefoRank(
    batches.map((b) => ({ id: b.id, batchNumber: b.batch_number, expiryDate: b.expiry_date })),
  );
  return batches
    .map((b) => {
      const days = daysToExpiry(b.expiry_date, asOf);
      return {
        id: b.id,
        batchNumber: b.batch_number,
        quantity: b.quantity,
        expiryDate: b.expiry_date,
        daysToExpiry: days,
        fefoRank: ranks.get(b.id) ?? 0,
        bucket: expiryBucket(days),
        lineValue: round2(b.quantity * unitCost),
      };
    })
    .sort((a, b) => a.fefoRank - b.fefoRank);
}

// ---------------------------------------------------------------------------
// Core shared fetch — used by dashboard, reorder, and briefing.
// ---------------------------------------------------------------------------

async function fetchAndBuildMetrics(): Promise<{
  asOf: Date;
  asOfIso: string;
  products: ProductRow[];
  metrics: ProductMetrics[];
  rawBatches: Map<string, BatchRow[]>;
  demandByProduct: Map<string, DemandPoint[]>;
  anomaliesByProduct: Map<string, AnomalyPoint[]>;
}> {
  const asOf = new Date();
  const asOfIso = asOf.toISOString().slice(0, 10);
  // Enforce SPEC §F3 trailing 90-day window (today + 89 prior days = 90 days inclusive).
  const cutoff = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate() - 89),
  )
    .toISOString()
    .slice(0, 10);

  const [suppliers, products, batches, demand] = await Promise.all([
    fetchSuppliers(),
    fetchProducts(),
    fetchBatches(),
    fetchDemand(),
  ]);

  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  const rawBatches = groupBy(batches, (b) => b.product_id);

  // Group demand with dates, filtered to the 90-day window.
  const demandRowsByProduct = groupBy(
    demand.filter((d) => d.date >= cutoff),
    (d) => d.product_id,
  );

  const demandByProduct = new Map<string, DemandPoint[]>();
  for (const [pid, rows] of demandRowsByProduct) {
    demandByProduct.set(
      pid,
      rows.map((r) => ({ date: r.date, qty: r.qty })),
    );
  }

  // Detect anomalies per product.
  const anomaliesByProduct = new Map<string, AnomalyPoint[]>();
  for (const [pid, points] of demandByProduct) {
    anomaliesByProduct.set(pid, detectAnomalies(points));
  }

  const metrics = products
    .map((product) => {
      const productBatches = rawBatches.get(product.id) ?? [];
      const productDemandPoints = demandByProduct.get(product.id) ?? [];
      const productAnomalies = anomaliesByProduct.get(product.id) ?? [];

      const base = computeMetrics(
        product,
        supplierById.get(product.supplier_id),
        productBatches,
        productDemandPoints.map((d) => d.qty),
      );

      // Phase 2 enrichment
      const minDaysToExpiry =
        productBatches.length > 0
          ? Math.min(...productBatches.map((b) => daysToExpiry(b.expiry_date, asOf)))
          : 9999;

      const valueAtRisk30d = round2(
        productBatches
          .filter((b) => {
            const d = daysToExpiry(b.expiry_date, asOf);
            return d >= 0 && d <= 30;
          })
          .reduce((sum, b) => sum + b.quantity * product.unit_cost, 0),
      );

      return {
        ...base,
        hasAnomaly: hasRecentAnomaly(productAnomalies, asOfIso),
        minDaysToExpiry,
        valueAtRisk30d,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { asOf, asOfIso, products, metrics, rawBatches, demandByProduct, anomaliesByProduct };
}

// ---------------------------------------------------------------------------
// Public queries.
// ---------------------------------------------------------------------------

/** All products with computed stock + reorder metrics (Dashboard F1). */
export async function getInventoryOverview(): Promise<ProductMetrics[]> {
  const { metrics } = await fetchAndBuildMetrics();
  return metrics;
}

/** Dashboard payload: product metrics, batch views, demand history, anomalies. */
export async function getDashboardData(): Promise<{
  products: ProductMetrics[];
  batchesByProduct: Record<string, BatchView[]>;
  demandByProduct: Record<string, DemandPoint[]>;
  anomaliesByProduct: Record<string, AnomalyPoint[]>;
}> {
  const { asOf, products, metrics, rawBatches, demandByProduct, anomaliesByProduct } =
    await fetchAndBuildMetrics();

  const batchesByProduct: Record<string, BatchView[]> = {};
  for (const product of products) {
    batchesByProduct[product.id] = toBatchViews(
      rawBatches.get(product.id) ?? [],
      product.unit_cost,
      asOf,
    );
  }

  return {
    products: metrics,
    batchesByProduct,
    demandByProduct: Object.fromEntries(demandByProduct),
    anomaliesByProduct: Object.fromEntries(anomaliesByProduct),
  };
}

/** Value-at-risk KPIs and the batches behind them (Expiry risk page F2). */
export async function getExpiryRisk(): Promise<ExpiryRisk> {
  const asOf = new Date();
  const [products, batches] = await Promise.all([fetchProducts(), fetchBatches()]);
  const productById = new Map(products.map((p) => [p.id, p]));

  const valued = batches.map((b) => ({
    quantity: b.quantity,
    unitCost: productById.get(b.product_id)?.unit_cost ?? 0,
    expiryDate: b.expiry_date,
  }));

  // Separate expired (sunk loss) from future-expiring (still at risk) for distinct KPIs.
  const futureValued = valued.filter((v) => daysToExpiry(v.expiryDate, asOf) >= 0);
  const expiredValued = valued.filter((v) => daysToExpiry(v.expiryDate, asOf) < 0);

  const kpis = EXPIRY_HORIZONS.map((horizonDays) => ({
    horizonDays,
    value: valueAtRisk(futureValued, horizonDays, asOf),
    batchCount: futureValued.filter((v) => daysToExpiry(v.expiryDate, asOf) <= horizonDays).length,
  }));

  const expiredValue = round2(
    expiredValued.reduce((sum, v) => sum + v.quantity * v.unitCost, 0),
  );
  const expiredCount = expiredValued.length;

  const expiringBatches: ExpiringBatchView[] = batches
    .map((b) => {
      const product = productById.get(b.product_id);
      const unitCost = product?.unit_cost ?? 0;
      const days = daysToExpiry(b.expiry_date, asOf);
      return {
        id: b.id,
        batchNumber: b.batch_number,
        quantity: b.quantity,
        expiryDate: b.expiry_date,
        daysToExpiry: days,
        fefoRank: -1, // not applicable in global expiry view
        bucket: expiryBucket(days),
        lineValue: round2(b.quantity * unitCost),
        productId: b.product_id,
        productName: product?.name ?? 'Unknown product',
        coldChain: product?.cold_chain ?? false,
      };
    })
    .filter((b) => b.daysToExpiry <= 90)
    .sort((a, b) => a.daysToExpiry - b.daysToExpiry);

  return { kpis, batches: expiringBatches, expiredValue, expiredCount };
}

/** Products flagged for reorder, most urgent first (Reorder page F3). */
export async function getReorderAlerts(): Promise<ProductMetrics[]> {
  const overview = await getInventoryOverview();
  const severity: Record<ProductMetrics['status'], number> = { Critical: 0, Reorder: 1, OK: 2 };
  return overview
    .filter((p) => p.status !== 'OK')
    .sort(
      (a, b) =>
        severity[a.status] - severity[b.status] || b.suggestedOrderQty - a.suggestedOrderQty,
    );
}

/** All data needed by the briefing rules engine (Briefing page F4). */
export async function getBriefingData(): Promise<BriefingInput> {
  const { asOf, asOfIso, metrics, rawBatches, demandByProduct, anomaliesByProduct } =
    await fetchAndBuildMetrics();

  // Build a product lookup for batch→coldChain
  const productById = new Map(metrics.map((m) => [m.id, m]));

  // Expiring batches (0 ≤ days ≤ 90), enriched with product info
  const expiringBatches: BriefingBatch[] = [];
  for (const [pid, batches] of rawBatches) {
    const product = productById.get(pid);
    if (!product) continue;
    for (const b of batches) {
      const days = daysToExpiry(b.expiry_date, asOf);
      if (days < 0 || days > 90) continue;
      expiringBatches.push({
        productName: product.name,
        batchNumber: b.batch_number,
        expiryDate: b.expiry_date,
        daysToExpiry: days,
        lineValue: round2(b.quantity * product.unitCost),
        coldChain: product.coldChain,
      });
    }
  }
  expiringBatches.sort((a, b) => a.daysToExpiry - b.daysToExpiry);

  // Recent anomalies (last 14 days only)
  const recentAnomalies: BriefingAnomaly[] = [];
  const cutoff14 = new Date(
    new Date(asOfIso + 'T00:00:00Z').getTime() - 13 * 86_400_000,
  )
    .toISOString()
    .slice(0, 10);

  for (const [pid, anomalies] of anomaliesByProduct) {
    const product = productById.get(pid);
    if (!product) continue;
    for (const a of anomalies) {
      if (a.date >= cutoff14) {
        recentAnomalies.push({
          productName: product.name,
          date: a.date,
          zScore: a.zScore,
        });
      }
    }
  }
  recentAnomalies.sort((a, b) => a.date.localeCompare(b.date));

  // Total value at risk ≤30d
  const valueAtRisk30d = round2(
    expiringBatches
      .filter((b) => b.daysToExpiry <= 30)
      .reduce((sum, b) => sum + b.lineValue, 0),
  );

  // Products for briefing (minimal shape)
  const briefingProducts: BriefingProduct[] = metrics.map((m) => ({
    name: m.name,
    status: m.status,
    coldChain: m.coldChain,
    leadTimeDays: m.leadTimeDays,
    suggestedOrderQty: m.suggestedOrderQty,
  }));

  // Suppress unused variable warning — demandByProduct is used in anomaly detection above
  void demandByProduct;

  return {
    valueAtRisk30d,
    products: briefingProducts,
    expiringBatches,
    recentAnomalies,
  };
}

/** All suppliers (for sandbox product forms). */
export async function getSuppliers(): Promise<SupplierRow[]> {
  return fetchSuppliers();
}
