import { getServerSupabase } from '@/lib/db/client';
import {
  demandStats,
  reorderPoint,
  safetyStock,
} from '@/lib/domain';

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) — identical to scripts/seed.ts so every
// reset produces the same dataset.
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED_VALUE = 0x50484152; // "PHAR"

function makePrng() {
  return mulberry32(SEED_VALUE);
}

function rand(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}
function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rand(rng, min, max + 1));
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[randInt(rng, 0, arr.length - 1)]!;
}

function gaussian(rng: () => number, mean: number, stdDev: number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return mean + stdDev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function dateOffset(todayUTC: Date, days: number): string {
  const d = new Date(todayUTC);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Static reference data (mirrors scripts/seed.ts exactly)
// ---------------------------------------------------------------------------
const SUPPLIERS = [
  { name: 'Medikere Pharma', country: 'Germany', lead_time_days: 7 },
  { name: 'Aventclaire Labs', country: 'France', lead_time_days: 12 },
  { name: 'Nordhelm Biotech', country: 'Sweden', lead_time_days: 21 },
  { name: 'Iberosalud S.A.', country: 'Spain', lead_time_days: 30 },
  { name: 'Lombard Farmaceutici', country: 'Italy', lead_time_days: 5 },
  { name: 'Batavia Generics', country: 'Netherlands', lead_time_days: 18 },
] as const;

interface ProductTemplate {
  name: string;
  category: string;
  coldChain?: boolean;
  packSize?: number;
  costRange: [number, number];
  demandRange: [number, number];
}

const PRODUCTS: ProductTemplate[] = [
  { name: 'Amoxicillin 500mg caps', category: 'Antibiotics', costRange: [2, 9], demandRange: [25, 45] },
  { name: 'Azithromycin 250mg tabs', category: 'Antibiotics', costRange: [4, 14], demandRange: [12, 28] },
  { name: 'Ciprofloxacin 500mg tabs', category: 'Antibiotics', costRange: [3, 11], demandRange: [10, 24] },
  { name: 'Doxycycline 100mg caps', category: 'Antibiotics', costRange: [2, 8], demandRange: [10, 22] },
  { name: 'Cefuroxime 500mg tabs', category: 'Antibiotics', costRange: [5, 16], demandRange: [8, 18] },
  { name: 'Clarithromycin 500mg tabs', category: 'Antibiotics', costRange: [6, 18], demandRange: [8, 16] },
  { name: 'Paracetamol 500mg tabs', category: 'Analgesics', costRange: [1, 4], demandRange: [35, 60] },
  { name: 'Ibuprofen 400mg tabs', category: 'Analgesics', costRange: [1.5, 5], demandRange: [28, 50] },
  { name: 'Naproxen 500mg tabs', category: 'Analgesics', costRange: [2, 7], demandRange: [14, 30] },
  { name: 'Diclofenac 50mg tabs', category: 'Analgesics', costRange: [2, 6], demandRange: [12, 26] },
  { name: 'Tramadol 50mg caps', category: 'Analgesics', costRange: [3, 9], demandRange: [10, 20] },
  { name: 'Morphine 10mg/ml injection', category: 'Analgesics', packSize: 5, costRange: [8, 22], demandRange: [4, 10] },
  { name: 'Atorvastatin 20mg tabs', category: 'Cardiovascular', costRange: [3, 12], demandRange: [30, 50] },
  { name: 'Amlodipine 5mg tabs', category: 'Cardiovascular', costRange: [2, 8], demandRange: [22, 40] },
  { name: 'Bisoprolol 5mg tabs', category: 'Cardiovascular', costRange: [2, 9], demandRange: [18, 34] },
  { name: 'Ramipril 5mg caps', category: 'Cardiovascular', costRange: [3, 10], demandRange: [16, 30] },
  { name: 'Losartan 50mg tabs', category: 'Cardiovascular', costRange: [3, 11], demandRange: [16, 30] },
  { name: 'Clopidogrel 75mg tabs', category: 'Cardiovascular', costRange: [5, 16], demandRange: [10, 22] },
  { name: 'Furosemide 40mg tabs', category: 'Cardiovascular', costRange: [2, 7], demandRange: [12, 24] },
  { name: 'Influenza Quadrivalent injection', category: 'Vaccines', coldChain: true, packSize: 10, costRange: [9, 18], demandRange: [6, 18] },
  { name: 'Hepatitis B Adult injection', category: 'Vaccines', coldChain: true, packSize: 10, costRange: [12, 24], demandRange: [4, 12] },
  { name: 'Tetanus-Diphtheria injection', category: 'Vaccines', coldChain: true, packSize: 10, costRange: [8, 16], demandRange: [4, 12] },
  { name: 'Pneumococcal 13-valent injection', category: 'Vaccines', coldChain: true, packSize: 10, costRange: [30, 70], demandRange: [3, 9] },
  { name: 'MMR injection', category: 'Vaccines', coldChain: true, packSize: 10, costRange: [14, 28], demandRange: [3, 9] },
  { name: 'Trastuzumab 150mg vial', category: 'Oncology', coldChain: true, packSize: 1, costRange: [600, 1100], demandRange: [1, 4] },
  { name: 'Rituximab 500mg vial', category: 'Oncology', coldChain: true, packSize: 1, costRange: [700, 1200], demandRange: [1, 4] },
  { name: 'Bevacizumab 100mg vial', category: 'Oncology', coldChain: true, packSize: 1, costRange: [300, 700], demandRange: [1, 5] },
  { name: 'Filgrastim 30MU injection', category: 'Oncology', coldChain: true, packSize: 1, costRange: [80, 200], demandRange: [2, 6] },
  { name: 'Metformin 1000mg tabs', category: 'Diabetes', costRange: [1.5, 6], demandRange: [30, 50] },
  { name: 'Gliclazide 80mg tabs', category: 'Diabetes', costRange: [2, 8], demandRange: [16, 30] },
  { name: 'Insulin Glargine 100U/ml', category: 'Diabetes', coldChain: true, packSize: 5, costRange: [35, 75], demandRange: [10, 22] },
  { name: 'Sitagliptin 100mg tabs', category: 'Diabetes', costRange: [6, 18], demandRange: [12, 24] },
  { name: 'Empagliflozin 10mg tabs', category: 'Diabetes', costRange: [7, 20], demandRange: [12, 24] },
  { name: 'Salbutamol 100mcg inhaler', category: 'Respiratory', packSize: 1, costRange: [3, 9], demandRange: [18, 34] },
  { name: 'Budesonide 200mcg inhaler', category: 'Respiratory', packSize: 1, costRange: [8, 20], demandRange: [10, 22] },
  { name: 'Montelukast 10mg tabs', category: 'Respiratory', costRange: [4, 12], demandRange: [12, 24] },
  { name: 'Tiotropium 18mcg caps', category: 'Respiratory', packSize: 1, costRange: [20, 55], demandRange: [6, 14] },
  { name: 'Hydrocortisone 1% cream', category: 'Dermatology', packSize: 1, costRange: [2, 6], demandRange: [10, 20] },
  { name: 'Clotrimazole 1% cream', category: 'Dermatology', packSize: 1, costRange: [2, 7], demandRange: [8, 18] },
  { name: 'Betamethasone 0.1% cream', category: 'Dermatology', packSize: 1, costRange: [3, 9], demandRange: [8, 16] },
];

const ANOMALIES: Array<[number, number, number]> = [
  [0, 3, 4.2], [12, 7, 3.8], [28, 10, 4.5], [6, 25, 3.9],
];

const CRITICAL_PRODUCTS = new Set([16, 27, 34]);
const REORDER_PRODUCTS = new Set([14, 18, 22, 31, 37]);

function batchCode(name: string, seq: number): string {
  const letters = name.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase();
  return `${letters}-${String(seq).padStart(4, '0')}`;
}

function expiryOffsetDays(rng: () => number, productIndex: number, batchIndex: number): number {
  if (batchIndex === 0) {
    if (productIndex < 3) return randInt(rng, -55, -4);
    if (productIndex < 6) return randInt(rng, 5, 30);
    if (productIndex < 10) return randInt(rng, 31, 60);
    if (productIndex < 14) return randInt(rng, 61, 90);
  }
  if (batchIndex === 1 && productIndex >= 14 && productIndex < 20) {
    return randInt(rng, 70, 150);
  }
  return randInt(rng, 150, 550);
}

async function chunkedInsert(
  supabase: ReturnType<typeof import('@/lib/db/client').getServerSupabase>,
  table: string,
  rows: Record<string, unknown>[],
  size = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    const slice = rows.slice(i, i + size);
    const { error } = await supabase.from(table).insert(slice);
    if (error) throw new Error(`Insert into ${table} failed: ${error.message}`);
  }
}

async function runSeed(supabase: ReturnType<typeof import('@/lib/db/client').getServerSupabase>): Promise<void> {
  const rng = makePrng();
  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  // Delete in FK order
  for (const table of ['demand_history', 'batches', 'products', 'suppliers']) {
    const { error } = await supabase.from(table).delete().not('id', 'is', null);
    if (error) throw new Error(`Delete from ${table} failed: ${error.message}`);
  }

  // Suppliers
  const { data: suppliers, error: supErr } = await supabase
    .from('suppliers')
    .insert(SUPPLIERS.map((s) => ({ ...s })))
    .select('id, lead_time_days');
  if (supErr || !suppliers) throw new Error(`Insert suppliers failed: ${supErr?.message ?? 'no rows'}`);

  const leadByProduct: number[] = [];
  const productRows = PRODUCTS.map((p) => {
    const supplier = pick(rng, suppliers) as { id: string; lead_time_days: number };
    leadByProduct.push(supplier.lead_time_days);
    return {
      name: p.name,
      category: p.category,
      unit_cost: round2(rand(rng, p.costRange[0], p.costRange[1])),
      pack_size: p.packSize ?? 10,
      cold_chain: p.coldChain ?? false,
      supplier_id: supplier.id,
    };
  });

  const { data: products, error: prodErr } = await supabase
    .from('products')
    .insert(productRows)
    .select('id');
  if (prodErr || !products) throw new Error(`Insert products failed: ${prodErr?.message ?? 'no rows'}`);

  const baseDemand = PRODUCTS.map((p) =>
    Math.max(1, Math.round(rand(rng, p.demandRange[0], p.demandRange[1]))),
  );

  const anomalyMap = new Map<string, number>();
  for (const [idx, daysAgo, mult] of ANOMALIES) {
    anomalyMap.set(`${idx}:${daysAgo}`, mult);
  }

  const demandSeries: number[][] = PRODUCTS.map((_, i) => {
    const base = baseDemand[i]!;
    const series: number[] = [];
    for (let daysAgo = 89; daysAgo >= 0; daysAgo--) {
      const dow = new Date(dateOffset(todayUTC, -daysAgo)).getUTCDay();
      const weekendFactor = dow === 0 || dow === 6 ? 0.55 : 1;
      const spike = anomalyMap.get(`${i}:${daysAgo}`);
      const qty =
        spike !== undefined
          ? Math.round(base * spike)
          : Math.max(0, Math.round(base * weekendFactor + gaussian(rng, 0, base * 0.18)));
      series.push(qty);
    }
    return series;
  });

  const targetStock = PRODUCTS.map((_, i) => {
    const stats = demandStats(demandSeries[i]!);
    const ss = safetyStock(stats.stdDev, leadByProduct[i]!);
    const rop = reorderPoint(stats.mean, leadByProduct[i]!, ss);
    if (CRITICAL_PRODUCTS.has(i)) return Math.max(0, Math.round(ss * rand(rng, 0.2, 0.7)));
    if (REORDER_PRODUCTS.has(i)) {
      const between = Math.round(ss + (rop - ss) * rand(rng, 0.3, 0.85));
      return Math.min(Math.floor(rop), Math.max(Math.round(ss) + 1, between));
    }
    return Math.round(stats.mean * rand(rng, 45, 85));
  });

  const batchRows: Array<Record<string, unknown>> = [];
  let batchSeq = 1;
  PRODUCTS.forEach((p, i) => {
    const numBatches = randInt(rng, 3, 4);
    const perBatch = Math.floor(targetStock[i]! / numBatches);
    for (let b = 0; b < numBatches; b++) {
      const offset = expiryOffsetDays(rng, i, b);
      const quantity = b === 0 ? targetStock[i]! - perBatch * (numBatches - 1) : perBatch;
      const received = Math.min(-5, offset - randInt(rng, 120, 540));
      batchRows.push({
        product_id: products[i]!.id,
        batch_number: batchCode(p.name, batchSeq++),
        quantity: Math.max(0, quantity),
        expiry_date: dateOffset(todayUTC, offset),
        received_at: dateOffset(todayUTC, Math.max(received, -700)),
      });
    }
  });
  await chunkedInsert(supabase, 'batches', batchRows);

  const demandRows: Array<Record<string, unknown>> = [];
  demandSeries.forEach((series, i) => {
    series.forEach((qty, k) => {
      demandRows.push({ product_id: products[i]!.id, date: dateOffset(todayUTC, -(89 - k)), qty });
    });
  });
  await chunkedInsert(supabase, 'demand_history', demandRows);
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    await runSeed(getServerSupabase());
    return Response.json({ ok: true, reset: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
