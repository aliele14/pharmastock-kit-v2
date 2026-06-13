import type { ExpiryBucket, IsoDate, StockStatus } from '@/lib/domain';

// ---------------------------------------------------------------------------
// Raw database rows (snake_case, mirror the SQL schema).
// ---------------------------------------------------------------------------
export interface SupplierRow {
  id: string;
  name: string;
  country: string;
  lead_time_days: number;
}

export interface ProductRow {
  id: string;
  name: string;
  category: string;
  unit_cost: number;
  pack_size: number;
  cold_chain: boolean;
  supplier_id: string;
  created_at: string;
}

export interface BatchRow {
  id: string;
  product_id: string;
  batch_number: string;
  quantity: number;
  expiry_date: IsoDate;
  received_at: IsoDate;
}

export interface DemandRow {
  product_id: string;
  date: IsoDate;
  qty: number;
}

// ---------------------------------------------------------------------------
// View models (camelCase) returned to the UI. All business math is already
// applied here via the domain layer — components never compute it.
// ---------------------------------------------------------------------------
export interface ProductMetrics {
  id: string;
  name: string;
  category: string;
  unitCost: number;
  packSize: number;
  coldChain: boolean;
  supplierName: string;
  leadTimeDays: number;
  totalStock: number;
  status: StockStatus;
  meanDemand: number;
  stdDevDemand: number;
  safetyStock: number;
  reorderPoint: number;
  suggestedOrderQty: number;
}

export interface BatchView {
  id: string;
  batchNumber: string;
  quantity: number;
  expiryDate: IsoDate;
  daysToExpiry: number;
  fefoRank: number;
  bucket: ExpiryBucket;
  lineValue: number;
}

export interface ExpiryKpi {
  horizonDays: number;
  value: number;
  batchCount: number;
}

export interface ExpiringBatchView extends BatchView {
  productId: string;
  productName: string;
  coldChain: boolean;
}

export interface ExpiryRisk {
  kpis: ExpiryKpi[];
  batches: ExpiringBatchView[];
  expiredValue: number;
  expiredCount: number;
}
