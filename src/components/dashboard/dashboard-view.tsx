'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  PackageSearch,
  Search,
  Snowflake,
  TrendingDown,
  X,
  Zap,
} from 'lucide-react';
import type { StockStatus } from '@/lib/domain';
import type { AnomalyPoint, DemandPoint } from '@/lib/domain';
import type { BatchView, ProductMetrics } from '@/lib/db/types';
import {
  formatCurrency,
  formatCurrencyPrecise,
  formatDate,
  formatDaysToExpiry,
  formatNumber,
} from '@/lib/format';
import { ColdChainBadge, ExpiryBadge, StatusBadge } from '@/components/badges';
import { Card, EmptyState } from '@/components/ui';

type SortKey = 'name' | 'category' | 'supplierName' | 'totalStock' | 'unitCost' | 'status';
type SortDir = 'asc' | 'desc';

const STATUS_ORDER: Record<StockStatus, number> = { Critical: 0, Reorder: 1, OK: 2 };

const inputClass =
  'h-9 rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent';

// ---------------------------------------------------------------------------
// Chip definitions (F6 — preset quick questions)
// ---------------------------------------------------------------------------

type ChipId = 'expiring-60' | 'below-reorder' | 'cold-at-risk' | 'top-var' | 'anomalies';

interface Chip {
  id: ChipId;
  label: string;
  icon: React.ReactNode;
}

const CHIPS: Chip[] = [
  { id: 'expiring-60', label: 'Expiring ≤60 days', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  { id: 'below-reorder', label: 'Below reorder point', icon: <TrendingDown className="h-3.5 w-3.5" /> },
  { id: 'cold-at-risk', label: 'Cold-chain at risk', icon: <Snowflake className="h-3.5 w-3.5" /> },
  { id: 'top-var', label: 'Top value at risk', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  { id: 'anomalies', label: 'Demand anomalies', icon: <Zap className="h-3.5 w-3.5" /> },
];

function applyChip(
  products: ProductMetrics[],
  chip: ChipId,
): { filtered: ProductMetrics[]; sortKey: SortKey; sortDir: SortDir } {
  switch (chip) {
    case 'expiring-60':
      return {
        filtered: products.filter((p) => p.minDaysToExpiry <= 60),
        sortKey: 'name',
        sortDir: 'asc',
      };
    case 'below-reorder':
      return {
        filtered: products.filter((p) => p.status !== 'OK'),
        sortKey: 'status',
        sortDir: 'asc',
      };
    case 'cold-at-risk':
      return {
        filtered: products.filter((p) => p.coldChain && p.status !== 'OK'),
        sortKey: 'status',
        sortDir: 'asc',
      };
    case 'top-var':
      return {
        filtered: products.filter((p) => p.valueAtRisk30d > 0),
        sortKey: 'name',
        sortDir: 'asc',
      };
    case 'anomalies':
      return {
        filtered: products.filter((p) => p.hasAnomaly),
        sortKey: 'name',
        sortDir: 'asc',
      };
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DashboardView({
  products,
  batchesByProduct,
  demandByProduct,
  anomaliesByProduct,
}: {
  products: ProductMetrics[];
  batchesByProduct: Record<string, BatchView[]>;
  demandByProduct: Record<string, DemandPoint[]>;
  anomaliesByProduct: Record<string, AnomalyPoint[]>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chipParam = searchParams.get('chip') as ChipId | null;

  const [activeChip, setActiveChip] = useState<ChipId | null>(chipParam);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [supplier, setSupplier] = useState('');
  const [status, setStatus] = useState('');
  const [coldOnly, setColdOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>(() =>
    chipParam ? applyChip(products, chipParam).sortKey : 'name',
  );
  const [sortDir, setSortDir] = useState<SortDir>(() =>
    chipParam ? applyChip(products, chipParam).sortDir : 'asc',
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleChip = useCallback(
    (id: ChipId) => {
      if (activeChip === id) {
        setActiveChip(null);
        setSortKey('name');
        setSortDir('asc');
        router.replace('/', { scroll: false });
      } else {
        setActiveChip(id);
        const applied = applyChip(products, id);
        setSortKey(applied.sortKey);
        setSortDir(applied.sortDir);
        router.replace(`/?chip=${id}`, { scroll: false });
      }
    },
    [activeChip, products, router],
  );

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category))].sort(),
    [products],
  );
  const suppliers = useMemo(
    () => [...new Set(products.map((p) => p.supplierName))].sort(),
    [products],
  );

  const visible = useMemo(() => {
    let base = activeChip ? applyChip(products, activeChip).filtered : products;

    const term = search.trim().toLowerCase();
    base = base.filter((p) => {
      if (term && !p.name.toLowerCase().includes(term)) return false;
      if (category && p.category !== category) return false;
      if (supplier && p.supplierName !== supplier) return false;
      if (status && p.status !== status) return false;
      if (coldOnly && !p.coldChain) return false;
      return true;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...base].sort((a, b) => {
      let cmp: number;
      if (sortKey === 'status') cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      else if (sortKey === 'totalStock') cmp = a.totalStock - b.totalStock;
      else if (sortKey === 'unitCost') cmp = a.unitCost - b.unitCost;
      else cmp = String(a[sortKey]).localeCompare(String(b[sortKey]));
      return cmp * dir;
    });
  }, [products, activeChip, search, category, supplier, status, coldOnly, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const selected = selectedId ? (products.find((p) => p.id === selectedId) ?? null) : null;
  const hasFilters = Boolean(search || category || supplier || status || coldOnly);

  function clearAll() {
    setSearch('');
    setCategory('');
    setSupplier('');
    setStatus('');
    setColdOnly(false);
    setActiveChip(null);
    setSortKey('name');
    setSortDir('asc');
    router.replace('/', { scroll: false });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Inventory</h1>
        <p className="text-sm text-muted">
          {formatNumber(products.length)} products · click a row for batches and reorder detail.
        </p>
      </div>

      {/* Quick-question chips (F6) */}
      <div className="flex flex-wrap gap-2">
        {CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => handleChip(chip.id)}
            aria-pressed={activeChip === chip.id}
            className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
              activeChip === chip.id
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border bg-surface text-muted hover:border-accent/50 hover:text-foreground'
            }`}
          >
            {chip.icon}
            {chip.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            className={`${inputClass} w-56 pl-9`}
            aria-label="Search products by name"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={inputClass}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          className={inputClass}
          aria-label="Filter by supplier"
        >
          <option value="">All suppliers</option>
          {suppliers.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={inputClass}
          aria-label="Filter by status"
        >
          <option value="">Any status</option>
          <option value="Critical">Critical</option>
          <option value="Reorder">Reorder</option>
          <option value="OK">OK</option>
        </select>
        <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm text-foreground">
          <input
            type="checkbox"
            checked={coldOnly}
            onChange={(e) => setColdOnly(e.target.checked)}
            className="accent-accent"
          />
          Cold chain
        </label>
        {(hasFilters || activeChip) ? (
          <button
            type="button"
            onClick={clearAll}
            className="flex h-9 items-center gap-1 rounded-lg px-2 text-sm text-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> Clear all
          </button>
        ) : null}
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <EmptyState
          icon={<PackageSearch className="h-6 w-6" />}
          title={products.length === 0 ? 'No products yet' : 'No products match your filters'}
          description={
            products.length === 0
              ? 'Run the seed script to populate the demo inventory.'
              : 'Try clearing the search or filters.'
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <Th
                    label="Product"
                    sortKey="name"
                    active={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <Th
                    label="Category"
                    sortKey="category"
                    active={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <Th
                    label="Supplier"
                    sortKey="supplierName"
                    active={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <Th
                    label="Stock"
                    sortKey="totalStock"
                    active={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    align="right"
                  />
                  <Th
                    label="Unit cost"
                    sortKey="unitCost"
                    active={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    align="right"
                  />
                  <Th
                    label="Status"
                    sortKey="status"
                    active={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={`cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-surface-muted ${
                      selectedId === p.id ? 'bg-surface-muted' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{p.name}</span>
                        {p.coldChain ? <ColdChainBadge /> : null}
                        {p.hasAnomaly ? <AnomalyBadge /> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{p.category}</td>
                    <td className="px-4 py-3 text-muted">{p.supplierName}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {formatNumber(p.totalStock)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {formatCurrencyPrecise(p.unitCost)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {selected ? (
        <DetailPanel
          product={selected}
          batches={batchesByProduct[selected.id] ?? []}
          demand={demandByProduct[selected.id] ?? []}
          anomalies={anomaliesByProduct[selected.id] ?? []}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AnomalyBadge() {
  return (
    <span
      title="Demand anomaly detected in the last 14 days"
      className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/20"
    >
      <Zap className="h-3 w-3" aria-hidden />
      Anomaly
    </span>
  );
}

function Th({
  label,
  sortKey,
  active,
  dir,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const isActive = active === sortKey;
  return (
    <th className={`px-4 py-3 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${
          align === 'right' ? 'flex-row-reverse' : ''
        } ${isActive ? 'text-foreground' : ''}`}
      >
        {label}
        {isActive ? (
          dir === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-50" />
        )}
      </button>
    </th>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Demand sparkline
// ---------------------------------------------------------------------------

function DemandSparkline({
  demand,
  anomalies,
}: {
  demand: DemandPoint[];
  anomalies: AnomalyPoint[];
}) {
  const anomalyDates = useMemo(() => new Set(anomalies.map((a) => a.date)), [anomalies]);

  if (demand.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted">
        No demand history
      </div>
    );
  }

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-foreground">
        90-day demand
        {anomalies.length > 0 ? (
          <span className="ml-2 text-amber-600 dark:text-amber-400">
            · {anomalies.length} anomal{anomalies.length === 1 ? 'y' : 'ies'} detected
          </span>
        ) : null}
      </p>
      <ResponsiveContainer width="100%" height={72}>
        <LineChart data={demand} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <XAxis dataKey="date" hide />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip
            content={({ active: isActive, payload }) => {
              if (!isActive || !payload?.[0]) return null;
              const point = payload[0].payload as DemandPoint;
              const isAnomaly = anomalyDates.has(point.date);
              return (
                <div className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs shadow-sm">
                  <p className="text-muted">{formatDate(point.date)}</p>
                  <p className={`font-medium ${isAnomaly ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
                    {formatNumber(point.qty)} units{isAnomaly ? ' ⚡' : ''}
                  </p>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="qty"
            stroke="var(--color-accent, #0f766e)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            activeDot={{ r: 3, fill: 'var(--color-accent, #0f766e)' }}
          />
          {anomalies.map((a) => (
            <ReferenceDot
              key={a.date}
              x={a.date}
              y={a.qty}
              r={4}
              fill="#d97706"
              stroke="white"
              strokeWidth={1.5}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

function DetailPanel({
  product,
  batches,
  demand,
  anomalies,
  onClose,
}: {
  product: ProductMetrics;
  batches: BatchView[];
  demand: DemandPoint[];
  anomalies: AnomalyPoint[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-30 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="detail-panel-title">
      <button
        type="button"
        aria-label="Close detail panel"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
      />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-surface shadow-xl">
        <div className="flex items-start justify-between gap-2 border-b border-border p-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="detail-panel-title" className="text-base font-semibold text-foreground">{product.name}</h2>
              {product.coldChain ? <ColdChainBadge /> : null}
            </div>
            <p className="mt-1 text-sm text-muted">
              {product.category} · {product.supplierName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-muted hover:bg-surface-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <StatusBadge status={product.status} />
            <span className="text-sm text-muted">{formatNumber(product.totalStock)} in stock</span>
          </div>

          <DemandSparkline demand={demand} anomalies={anomalies} />

          <div className="rounded-lg border border-border p-3">
            <MetricRow label="Avg daily demand" value={formatNumber(product.meanDemand)} />
            <MetricRow label="Demand std dev" value={formatNumber(product.stdDevDemand)} />
            <MetricRow label="Lead time" value={`${formatNumber(product.leadTimeDays)} days`} />
            <MetricRow label="Safety stock" value={formatNumber(product.safetyStock)} />
            <MetricRow label="Reorder point" value={formatNumber(product.reorderPoint)} />
            <MetricRow label="Unit cost" value={formatCurrencyPrecise(product.unitCost)} />
            {product.status !== 'OK' ? (
              <MetricRow
                label="Suggested order"
                value={`${formatNumber(product.suggestedOrderQty)} units`}
              />
            ) : null}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-foreground">
              Batches ({batches.length}) · FEFO order
            </h3>
            {batches.length === 0 ? (
              <p className="text-sm text-muted">No batches recorded.</p>
            ) : (
              <ul className="space-y-2">
                {batches.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-sm"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        <span className="mr-1.5 text-xs text-muted">#{b.fefoRank}</span>
                        {b.batchNumber}
                      </p>
                      <p className="text-xs text-muted">
                        {formatNumber(b.quantity)} units · exp {formatDate(b.expiryDate)} ·{' '}
                        {formatDaysToExpiry(b.daysToExpiry)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <ExpiryBadge bucket={b.bucket} />
                      <span className="text-xs tabular-nums text-muted">
                        {formatCurrency(b.lineValue)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
