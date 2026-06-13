import 'server-only';
import {
  daysToExpiry,
  demandStats,
  expiryBucket,
  fefoRank,
  reorderPoint,
  safetyStock,
  stockStatus,
  suggestedOrderQty,
  valueAtRisk,
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
// Public queries.
// ---------------------------------------------------------------------------

async function fetchAndBuildMetrics(): Promise<{
  products: ProductRow[];
  metrics: ProductMetrics[];
  rawBatches: Map<string, BatchRow[]>;
}> {
  const [suppliers, products, batches, demand] = await Promise.all([
    fetchSuppliers(),
    fetchProducts(),
    fetchBatches(),
    fetchDemand(),
  ]);

  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  const rawBatches = groupBy(batches, (b) => b.product_id);
  const demandByProduct = groupBy(demand, (d) => d.product_id);

  const metrics = products
    .map((product) =>
      computeMetrics(
        product,
        supplierById.get(product.supplier_id),
        rawBatches.get(product.id) ?? [],
        (demandByProduct.get(product.id) ?? []).map((d) => d.qty),
      ),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return { products, metrics, rawBatches };
}

/** All products with computed stock + reorder metrics (Dashboard F1). */
export async function getInventoryOverview(): Promise<ProductMetrics[]> {
  const { metrics } = await fetchAndBuildMetrics();
  return metrics;
}

/** Dashboard payload: product metrics plus their batch views, fetched once. */
export async function getDashboardData(): Promise<{
  products: ProductMetrics[];
  batchesByProduct: Record<string, BatchView[]>;
}> {
  const asOf = new Date();
  const { products, metrics, rawBatches } = await fetchAndBuildMetrics();

  const batchesByProduct: Record<string, BatchView[]> = {};
  for (const product of products) {
    batchesByProduct[product.id] = toBatchViews(
      rawBatches.get(product.id) ?? [],
      product.unit_cost,
      asOf,
    );
  }

  return { products: metrics, batchesByProduct };
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

  const kpis = EXPIRY_HORIZONS.map((horizonDays) => ({
    horizonDays,
    value: valueAtRisk(valued, horizonDays, asOf),
    batchCount: batches.filter((b) => daysToExpiry(b.expiry_date, asOf) <= horizonDays).length,
  }));

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

  return { kpis, batches: expiringBatches };
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
