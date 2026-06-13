'use client';

import { useState } from 'react';
import type { SupplierRow } from '@/lib/db/types';

const CATEGORIES = [
  'Antibiotics',
  'Analgesics',
  'Cardiovascular',
  'Vaccines',
  'Oncology',
  'Diabetes',
  'Respiratory',
  'Dermatology',
] as const;

const inputClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent';

const labelClass = 'block text-xs font-medium text-muted mb-1';

interface ProductFormValues {
  name: string;
  category: string;
  unit_cost: string;
  pack_size: string;
  cold_chain: boolean;
  supplier_id: string;
}

const EMPTY: ProductFormValues = {
  name: '',
  category: 'Antibiotics',
  unit_cost: '',
  pack_size: '10',
  cold_chain: false,
  supplier_id: '',
};

export function ProductForm({
  suppliers,
  initial,
  productId,
  onSuccess,
  onCancel,
}: {
  suppliers: SupplierRow[];
  initial?: Partial<ProductFormValues> & { id?: string };
  productId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<ProductFormValues>({
    ...EMPTY,
    ...(initial ?? {}),
    supplier_id: initial?.supplier_id ?? suppliers[0]?.id ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof ProductFormValues, value: string | boolean) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload = {
      name: values.name.trim(),
      category: values.category,
      unit_cost: parseFloat(values.unit_cost),
      pack_size: parseInt(values.pack_size, 10),
      cold_chain: values.cold_chain,
      supplier_id: values.supplier_id,
    };

    const url = productId ? `/api/products/${productId}` : '/api/products';
    const method = productId ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setError(json.error ?? 'Something went wrong.');
        return;
      }
      onSuccess();
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="pf-name" className={labelClass}>Name</label>
        <input
          id="pf-name"
          type="text"
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          required
          className={inputClass}
          placeholder="Amoxicillin 500mg caps"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="pf-category" className={labelClass}>Category</label>
          <select
            id="pf-category"
            value={values.category}
            onChange={(e) => set('category', e.target.value)}
            className={inputClass}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pf-supplier" className={labelClass}>Supplier</label>
          <select
            id="pf-supplier"
            value={values.supplier_id}
            onChange={(e) => set('supplier_id', e.target.value)}
            required
            className={inputClass}
          >
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="pf-cost" className={labelClass}>Unit cost (€)</label>
          <input
            id="pf-cost"
            type="number"
            min="0.01"
            step="0.01"
            value={values.unit_cost}
            onChange={(e) => set('unit_cost', e.target.value)}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="pf-pack" className={labelClass}>Pack size</label>
          <input
            id="pf-pack"
            type="number"
            min="1"
            step="1"
            value={values.pack_size}
            onChange={(e) => set('pack_size', e.target.value)}
            required
            className={inputClass}
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={values.cold_chain}
          onChange={(e) => set('cold_chain', e.target.checked)}
          className="accent-accent"
        />
        Cold chain required
      </label>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-lg border border-border px-4 text-sm text-muted hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="h-9 rounded-lg bg-accent px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : productId ? 'Save changes' : 'Add product'}
        </button>
      </div>
    </form>
  );
}
