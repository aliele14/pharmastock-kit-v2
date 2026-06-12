import { Snowflake } from 'lucide-react';
import type { ExpiryBucket, StockStatus } from '@/lib/domain';

const baseBadge =
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset';

const STATUS_STYLES: Record<StockStatus, string> = {
  OK: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20',
  Reorder:
    'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/20',
  Critical:
    'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-400/20',
};

export function StatusBadge({ status }: { status: StockStatus }) {
  return <span className={`${baseBadge} ${STATUS_STYLES[status]}`}>{status}</span>;
}

const EXPIRY_STYLES: Record<ExpiryBucket, string> = {
  green:
    'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20',
  amber:
    'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-400/20',
  expired:
    'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-400/20',
};

const EXPIRY_LABELS: Record<ExpiryBucket, string> = {
  green: '> 90 days',
  amber: '31–90 days',
  red: '≤ 30 days',
  expired: 'Expired',
};

export function ExpiryBadge({ bucket }: { bucket: ExpiryBucket }) {
  return <span className={`${baseBadge} ${EXPIRY_STYLES[bucket]}`}>{EXPIRY_LABELS[bucket]}</span>;
}

export function ColdChainBadge() {
  return (
    <span
      className={`${baseBadge} bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-400/20`}
    >
      <Snowflake className="h-3 w-3" aria-hidden />
      Cold chain
    </span>
  );
}
