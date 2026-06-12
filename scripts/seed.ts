/**
 * Idempotent demo-data seed for PharmaStock.
 *
 * Run with `npm run seed`. Deletes all rows (child -> parent) and reinserts a
 * deterministic dataset using a seeded PRNG, so every reset looks identical in
 * shape. Absolute dates are anchored to "today" so the demo always shows
 * realistic relative expiry windows and recent demand anomalies.
 *
 * Deliberately included for the analytics features:
 *   - 3 already-expired batches and several near-expiry batches (expiry risk)
 *   - 4 demand-history spikes (z-score anomaly detection has real signal)
 *
 * Server-only: uses the Supabase service key, which bypasses RLS.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to .env.local before seeding.',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) + helpers
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

const rng = mulberry32(0x50484152); // "PHAR"

const rand = (min: number, max: number): number => min + rng() * (max - min);
const randInt = (min: number, max: number): number => Math.floor(rand(min, max + 1));
const round2 = (n: number): number => Math.round(n * 100) / 100;
const pick = <T>(arr: readonly T[]): T => arr[randInt(0, arr.length - 1)]!;

/** Standard-normal sample via Box-Muller, driven by the seeded PRNG. */
function gaussian(mean: number, stdDev: number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return mean + stdDev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Date helpers anchored to today (UTC date, no time component).
const TODAY = new Date();
const todayUTC = new Date(
  Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth(), TODAY.getUTCDate()),
);

function dateOffset(days: number): string {
  const d = new Date(todayUTC);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Static reference data (all fictional)
// ---------------------------------------------------------------------------
const SUPPLIERS = [
  { name: 'Medikere Pharma', country: 'Germany', lead_time_days: 7 },
  { name: 'Aventclaire Labs', country: 'France', lead_time_days: 12 },
  { name: 'Nordhelm Biotech', country: 'Sweden', lead_time_days: 21 },
  { name: 'Iberosalud S.A.', country: 'Spain', lead_time_days: 30 },
  { name: 'Lombard Farmaceutici', country: 'Italy', lead_time_days: 5 },
  { name: 'Batavia Generics', country: 'Netherlands', lead_time_days: 18 },
] as const;

type Category =
  | 'Antibiotics'
  | 'Analgesics'
  | 'Cardiovascular'
  | 'Vaccines'
  | 'Oncology'
  | 'Diabetes'
  | 'Respiratory'
  | 'Dermatology';

interface ProductTemplate {
  name: string;
  category: Category;
  coldChain?: boolean;
  packSize?: number;
  costRange: [number, number];
  demandRange: [number, number]; // avg daily demand
}

const PRODUCTS: ProductTemplate[] = [
  // Antibiotics
  {
    name: 'Amoxicillin 500mg caps',
    category: 'Antibiotics',
    costRange: [2, 9],
    demandRange: [25, 45],
  }, // index 0 (anomaly)
  {
    name: 'Azithromycin 250mg tabs',
    category: 'Antibiotics',
    costRange: [4, 14],
    demandRange: [12, 28],
  },
  {
    name: 'Ciprofloxacin 500mg tabs',
    category: 'Antibiotics',
    costRange: [3, 11],
    demandRange: [10, 24],
  },
  {
    name: 'Doxycycline 100mg caps',
    category: 'Antibiotics',
    costRange: [2, 8],
    demandRange: [10, 22],
  },
  {
    name: 'Cefuroxime 500mg tabs',
    category: 'Antibiotics',
    costRange: [5, 16],
    demandRange: [8, 18],
  },
  {
    name: 'Clarithromycin 500mg tabs',
    category: 'Antibiotics',
    costRange: [6, 18],
    demandRange: [8, 16],
  },
  // Analgesics
  {
    name: 'Paracetamol 500mg tabs',
    category: 'Analgesics',
    costRange: [1, 4],
    demandRange: [35, 60],
  }, // index 6 (anomaly)
  {
    name: 'Ibuprofen 400mg tabs',
    category: 'Analgesics',
    costRange: [1.5, 5],
    demandRange: [28, 50],
  },
  { name: 'Naproxen 500mg tabs', category: 'Analgesics', costRange: [2, 7], demandRange: [14, 30] },
  {
    name: 'Diclofenac 50mg tabs',
    category: 'Analgesics',
    costRange: [2, 6],
    demandRange: [12, 26],
  },
  { name: 'Tramadol 50mg caps', category: 'Analgesics', costRange: [3, 9], demandRange: [10, 20] },
  {
    name: 'Morphine 10mg/ml injection',
    category: 'Analgesics',
    packSize: 5,
    costRange: [8, 22],
    demandRange: [4, 10],
  },
  // Cardiovascular
  {
    name: 'Atorvastatin 20mg tabs',
    category: 'Cardiovascular',
    costRange: [3, 12],
    demandRange: [30, 50],
  }, // index 12 (anomaly)
  {
    name: 'Amlodipine 5mg tabs',
    category: 'Cardiovascular',
    costRange: [2, 8],
    demandRange: [22, 40],
  },
  {
    name: 'Bisoprolol 5mg tabs',
    category: 'Cardiovascular',
    costRange: [2, 9],
    demandRange: [18, 34],
  },
  {
    name: 'Ramipril 5mg caps',
    category: 'Cardiovascular',
    costRange: [3, 10],
    demandRange: [16, 30],
  },
  {
    name: 'Losartan 50mg tabs',
    category: 'Cardiovascular',
    costRange: [3, 11],
    demandRange: [16, 30],
  },
  {
    name: 'Clopidogrel 75mg tabs',
    category: 'Cardiovascular',
    costRange: [5, 16],
    demandRange: [10, 22],
  },
  {
    name: 'Furosemide 40mg tabs',
    category: 'Cardiovascular',
    costRange: [2, 7],
    demandRange: [12, 24],
  },
  // Vaccines (cold-chain)
  {
    name: 'Influenza Quadrivalent injection',
    category: 'Vaccines',
    coldChain: true,
    packSize: 10,
    costRange: [9, 18],
    demandRange: [6, 18],
  },
  {
    name: 'Hepatitis B Adult injection',
    category: 'Vaccines',
    coldChain: true,
    packSize: 10,
    costRange: [12, 24],
    demandRange: [4, 12],
  },
  {
    name: 'Tetanus-Diphtheria injection',
    category: 'Vaccines',
    coldChain: true,
    packSize: 10,
    costRange: [8, 16],
    demandRange: [4, 12],
  },
  {
    name: 'Pneumococcal 13-valent injection',
    category: 'Vaccines',
    coldChain: true,
    packSize: 10,
    costRange: [30, 70],
    demandRange: [3, 9],
  },
  {
    name: 'MMR injection',
    category: 'Vaccines',
    coldChain: true,
    packSize: 10,
    costRange: [14, 28],
    demandRange: [3, 9],
  },
  // Oncology (cold-chain)
  {
    name: 'Trastuzumab 150mg vial',
    category: 'Oncology',
    coldChain: true,
    packSize: 1,
    costRange: [600, 1100],
    demandRange: [1, 4],
  },
  {
    name: 'Rituximab 500mg vial',
    category: 'Oncology',
    coldChain: true,
    packSize: 1,
    costRange: [700, 1200],
    demandRange: [1, 4],
  },
  {
    name: 'Bevacizumab 100mg vial',
    category: 'Oncology',
    coldChain: true,
    packSize: 1,
    costRange: [300, 700],
    demandRange: [1, 5],
  },
  {
    name: 'Filgrastim 30MU injection',
    category: 'Oncology',
    coldChain: true,
    packSize: 1,
    costRange: [80, 200],
    demandRange: [2, 6],
  },
  // Diabetes
  {
    name: 'Metformin 1000mg tabs',
    category: 'Diabetes',
    costRange: [1.5, 6],
    demandRange: [30, 50],
  }, // index 28 (anomaly)
  { name: 'Gliclazide 80mg tabs', category: 'Diabetes', costRange: [2, 8], demandRange: [16, 30] },
  {
    name: 'Insulin Glargine 100U/ml',
    category: 'Diabetes',
    coldChain: true,
    packSize: 5,
    costRange: [35, 75],
    demandRange: [10, 22],
  },
  {
    name: 'Sitagliptin 100mg tabs',
    category: 'Diabetes',
    costRange: [6, 18],
    demandRange: [12, 24],
  },
  {
    name: 'Empagliflozin 10mg tabs',
    category: 'Diabetes',
    costRange: [7, 20],
    demandRange: [12, 24],
  },
  // Respiratory
  {
    name: 'Salbutamol 100mcg inhaler',
    category: 'Respiratory',
    packSize: 1,
    costRange: [3, 9],
    demandRange: [18, 34],
  },
  {
    name: 'Budesonide 200mcg inhaler',
    category: 'Respiratory',
    packSize: 1,
    costRange: [8, 20],
    demandRange: [10, 22],
  },
  {
    name: 'Montelukast 10mg tabs',
    category: 'Respiratory',
    costRange: [4, 12],
    demandRange: [12, 24],
  },
  {
    name: 'Tiotropium 18mcg caps',
    category: 'Respiratory',
    packSize: 1,
    costRange: [20, 55],
    demandRange: [6, 14],
  },
  // Dermatology
  {
    name: 'Hydrocortisone 1% cream',
    category: 'Dermatology',
    packSize: 1,
    costRange: [2, 6],
    demandRange: [10, 20],
  },
  {
    name: 'Clotrimazole 1% cream',
    category: 'Dermatology',
    packSize: 1,
    costRange: [2, 7],
    demandRange: [8, 18],
  },
  {
    name: 'Betamethasone 0.1% cream',
    category: 'Dermatology',
    packSize: 1,
    costRange: [3, 9],
    demandRange: [8, 16],
  },
];

// Demand anomalies to inject: [productIndex, daysAgo, spikeMultiplier].
// Three land inside the trailing 14 days (briefing watchlist), one is older.
const ANOMALIES: Array<[number, number, number]> = [
  [0, 3, 4.2],
  [12, 7, 3.8],
  [28, 10, 4.5],
  [6, 25, 3.9],
];

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------
function batchCode(name: string, seq: number): string {
  const letters = name
    .replace(/[^A-Za-z]/g, '')
    .slice(0, 4)
    .toUpperCase();
  return `${letters}-${String(seq).padStart(4, '0')}`;
}

/**
 * Pick an expiry offset (days from today) for batch `b` of product `i`.
 * Deterministically guarantees a few expired and several near-expiry batches.
 */
function expiryOffsetDays(productIndex: number, batchIndex: number): number {
  if (batchIndex === 0) {
    if (productIndex < 3) return randInt(-55, -4); // 3 already-expired batches
    if (productIndex < 6) return randInt(5, 30); // red bucket (<=30d)
    if (productIndex < 10) return randInt(31, 60); // amber bucket
    if (productIndex < 14) return randInt(61, 90); // amber/green boundary
  }
  if (batchIndex === 1 && productIndex >= 14 && productIndex < 20) {
    return randInt(70, 150);
  }
  return randInt(150, 550); // long-dated stock
}

async function chunkedInsert(
  table: string,
  rows: Record<string, unknown>[],
  size = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    const slice = rows.slice(i, i + size);
    const { error } = await supabase.from(table).insert(slice);
    if (error) {
      throw new Error(`Insert into ${table} failed: ${error.message}`);
    }
  }
}

async function deleteAll(table: string): Promise<void> {
  // `id` is never null, so this matches every row (supabase-js requires a filter).
  const { error } = await supabase.from(table).delete().not('id', 'is', null);
  if (error) {
    throw new Error(`Delete from ${table} failed: ${error.message}`);
  }
}

async function main(): Promise<void> {
  console.log('Resetting demo data...');
  // Child -> parent to respect foreign keys.
  await deleteAll('demand_history');
  await deleteAll('batches');
  await deleteAll('products');
  await deleteAll('suppliers');

  // Suppliers
  const { data: suppliers, error: supErr } = await supabase
    .from('suppliers')
    .insert(SUPPLIERS.map((s) => ({ ...s })))
    .select('id');
  if (supErr || !suppliers) {
    throw new Error(`Insert suppliers failed: ${supErr?.message ?? 'no rows returned'}`);
  }

  // Products
  const productRows = PRODUCTS.map((p) => ({
    name: p.name,
    category: p.category,
    unit_cost: round2(rand(p.costRange[0], p.costRange[1])),
    pack_size: p.packSize ?? 10,
    cold_chain: p.coldChain ?? false,
    supplier_id: pick(suppliers).id,
  }));
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .insert(productRows)
    .select('id');
  if (prodErr || !products) {
    throw new Error(`Insert products failed: ${prodErr?.message ?? 'no rows returned'}`);
  }

  // Per-product average daily demand (reused for batch sizing + history).
  const baseDemand = PRODUCTS.map((p) =>
    Math.max(1, Math.round(rand(p.demandRange[0], p.demandRange[1]))),
  );

  // Batches
  const batchRows: Array<{
    product_id: string;
    batch_number: string;
    quantity: number;
    expiry_date: string;
    received_at: string;
  }> = [];
  let batchSeq = 1;
  PRODUCTS.forEach((p, i) => {
    const numBatches = randInt(3, 4);
    for (let b = 0; b < numBatches; b++) {
      const offset = expiryOffsetDays(i, b);
      const expired = offset < 0;
      const qty = Math.max(0, Math.round(baseDemand[i]! * (expired ? rand(3, 14) : rand(8, 40))));
      const received = Math.min(-5, offset - randInt(120, 540)); // before expiry, in the past
      batchRows.push({
        product_id: products[i]!.id,
        batch_number: batchCode(p.name, batchSeq++),
        quantity: qty,
        expiry_date: dateOffset(offset),
        received_at: dateOffset(Math.max(received, -700)),
      });
    }
  });
  await chunkedInsert('batches', batchRows);

  // Demand history: 90 days per product with weekday seasonality + noise,
  // plus the deliberate anomaly spikes.
  const anomalyMap = new Map<string, number>();
  for (const [idx, daysAgo, mult] of ANOMALIES) {
    anomalyMap.set(`${idx}:${daysAgo}`, mult);
  }

  const demandRows: Array<{ product_id: string; date: string; qty: number }> = [];
  PRODUCTS.forEach((_, i) => {
    const base = baseDemand[i]!;
    for (let daysAgo = 89; daysAgo >= 0; daysAgo--) {
      const dateStr = dateOffset(-daysAgo);
      const dow = new Date(dateStr).getUTCDay();
      const weekendFactor = dow === 0 || dow === 6 ? 0.55 : 1;
      let qty = Math.max(0, Math.round(base * weekendFactor + gaussian(0, base * 0.18)));
      const spike = anomalyMap.get(`${i}:${daysAgo}`);
      if (spike !== undefined) {
        qty = Math.round(base * spike);
      }
      demandRows.push({ product_id: products[i]!.id, date: dateStr, qty });
    }
  });
  await chunkedInsert('demand_history', demandRows);

  console.log(
    `Seeded: ${suppliers.length} suppliers, ${products.length} products, ` +
      `${batchRows.length} batches, ${demandRows.length} demand rows.`,
  );
  console.log(
    `Included ${ANOMALIES.length} demand anomalies and ` +
      `${batchRows.filter((b) => b.expiry_date < dateOffset(0)).length} expired batches.`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
