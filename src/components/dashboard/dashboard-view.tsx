'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, PackageSearch, Search, X } from 'lucide-react';
import type { StockStatus } from '@/lib/domain';
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

export function DashboardView({
  products,
  batchesByProduct,
}: {
  products: ProductMetrics[];
  batchesByProduct: Record<string, BatchView[]>;
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [supplier, setSupplier] = useState('');
  const [status, setStatus] = useState('');
  const [coldOnly, setColdOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category))].sort(),
    [products],
  );
  const suppliers = useMemo(
    () => [...new Set(products.map((p) => p.supplierName))].sort(),
    [products],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = products.filter((p) => {
      if (term && !p.name.toLowerCase().includes(term)) return false;
      if (category && p.category !== category) return false;
      if (supplier && p.supplierName !== supplier) return false;
      if (status && p.status !== status) return false;
      if (coldOnly && !p.coldChain) return false;
      return true;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let cmp: number;
      if (sortKey === 'status') cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      else if (sortKey === 'totalStock') cmp = a.totalStock - b.totalStock;
      else if (sortKey === 'unitCost') cmp = a.unitCost - b.unitCost;
      else cmp = String(a[sortKey]).localeCompare(String(b[sortKey]));
      return cmp * dir;
    });
  }, [products, search, category, supplier, status, coldOnly, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const selected = selectedId ? (products.find((p) => p.id === selectedId) ?? null) : null;
  const hasFilters = Boolean(search || category || supplier || status || coldOnly);

  function clearFilters() {
    setSearch('');
    setCategory('');
    setSupplier('');
    setStatus('');
    setColdOnly(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Inventory</h1>
        <p className="text-sm text-muted">
          {formatNumber(products.length)} products · click a row for batches and reorder detail.
        </p>
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
        {hasFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="flex h-9 items-center gap-1 rounded-lg px-2 text-sm text-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> Clear
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
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
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

function DetailPanel({
  product,
  batches,
  onClose,
}: {
  product: ProductMetrics;
  batches: BatchView[];
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

          {/* Demand sparkline placeholder (Phase 2 / F5). */}
          <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted">
            90-day demand sparkline — added in Phase 2
          </div>

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
