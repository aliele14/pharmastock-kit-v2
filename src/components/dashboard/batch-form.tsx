'use client';

import { useState } from 'react';

const inputClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent';

const labelClass = 'block text-xs font-medium text-muted mb-1';

interface BatchFormValues {
  batch_number: string;
  quantity: string;
  expiry_date: string;
}

const EMPTY: BatchFormValues = { batch_number: '', quantity: '', expiry_date: '' };

export function BatchForm({
  productId,
  initial,
  batchId,
  onSuccess,
  onCancel,
}: {
  productId: string;
  initial?: Partial<BatchFormValues>;
  batchId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<BatchFormValues>({ ...EMPTY, ...(initial ?? {}) });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof BatchFormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload = batchId
      ? {
          batch_number: values.batch_number.trim() || undefined,
          quantity: values.quantity ? parseInt(values.quantity, 10) : undefined,
          expiry_date: values.expiry_date || undefined,
        }
      : {
          product_id: productId,
          batch_number: values.batch_number.trim(),
          quantity: parseInt(values.quantity, 10),
          expiry_date: values.expiry_date,
        };

    const url = batchId ? `/api/batches/${batchId}` : '/api/batches';
    const method = batchId ? 'PATCH' : 'POST';

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
        <label htmlFor="bf-num" className={labelClass}>Batch number</label>
        <input
          id="bf-num"
          type="text"
          value={values.batch_number}
          onChange={(e) => set('batch_number', e.target.value)}
          required={!batchId}
          className={inputClass}
          placeholder="e.g. AMOX-0005"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="bf-qty" className={labelClass}>Quantity</label>
          <input
            id="bf-qty"
            type="number"
            min="0"
            step="1"
            value={values.quantity}
            onChange={(e) => set('quantity', e.target.value)}
            required={!batchId}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="bf-exp" className={labelClass}>Expiry date</label>
          <input
            id="bf-exp"
            type="date"
            value={values.expiry_date}
            onChange={(e) => set('expiry_date', e.target.value)}
            required={!batchId}
            className={inputClass}
          />
        </div>
      </div>

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
          {submitting ? 'Saving…' : batchId ? 'Save changes' : 'Add batch'}
        </button>
      </div>
    </form>
  );
}
