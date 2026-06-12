import { CheckCircle2 } from 'lucide-react';
import { getReorderAlerts } from '@/lib/db/queries';
import { ColdChainBadge, StatusBadge } from '@/components/badges';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { formatNumber } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ReorderPage() {
  const alerts = await getReorderAlerts();
  const criticalCount = alerts.filter((a) => a.status === 'Critical').length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Reorder alerts"
        description="Products at or below their reorder point, most urgent first, with a suggested order quantity."
      />

      {alerts.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-6 w-6 text-emerald-500" />}
          title="Everything is well stocked"
          description="No product is at or below its reorder point. Check back after demand changes or a 24h reset."
        />
      ) : (
        <>
          <p className="text-sm text-muted">
            {formatNumber(alerts.length)} product{alerts.length === 1 ? '' : 's'} flagged
            {criticalCount > 0 ? ` · ${formatNumber(criticalCount)} critical` : ''}.
          </p>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {alerts.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-medium text-foreground">{p.name}</h2>
                      {p.coldChain ? <ColdChainBadge /> : null}
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {p.category} · {p.supplierName} · {formatNumber(p.leadTimeDays)}-day lead time
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <Metric label="In stock" value={formatNumber(p.totalStock)} />
                  <Metric label="Reorder point" value={formatNumber(p.reorderPoint)} />
                  <Metric
                    label="Suggested order"
                    value={formatNumber(p.suggestedOrderQty)}
                    emphasis
                  />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={`mt-0.5 tabular-nums ${
          emphasis ? 'text-base font-semibold text-accent' : 'text-foreground'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
