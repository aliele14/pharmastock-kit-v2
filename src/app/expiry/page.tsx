import { ShieldCheck } from 'lucide-react';
import { getExpiryRisk } from '@/lib/db/queries';
import { ColdChainBadge, ExpiryBadge } from '@/components/badges';
import { Card, EmptyState, KpiCard, PageHeader } from '@/components/ui';
import { formatCurrency, formatDate, formatDaysToExpiry, formatNumber } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ExpiryRiskPage() {
  const { kpis, batches } = await getExpiryRisk();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Expiry risk"
        description="Value at risk by horizon, and every batch expiring within 90 days (earliest first)."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.horizonDays}
            label={`Value at risk · ≤ ${kpi.horizonDays} days`}
            value={formatCurrency(kpi.value)}
            hint={`${formatNumber(kpi.batchCount)} batch${kpi.batchCount === 1 ? '' : 'es'}`}
          />
        ))}
      </div>

      {batches.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-6 w-6" />}
          title="Nothing expiring soon"
          description="No batches are within 90 days of expiry. Run the seed script if the inventory is empty."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Batch</th>
                  <th className="px-4 py-3 text-right font-medium">Quantity</th>
                  <th className="px-4 py-3 font-medium">Expiry</th>
                  <th className="px-4 py-3 font-medium">Days</th>
                  <th className="px-4 py-3 text-right font-medium">Value</th>
                  <th className="px-4 py-3 font-medium">Window</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{b.productName}</span>
                        {b.coldChain ? <ColdChainBadge /> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{b.batchNumber}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {formatNumber(b.quantity)}
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDate(b.expiryDate)}</td>
                    <td className="px-4 py-3 text-muted">{formatDaysToExpiry(b.daysToExpiry)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {formatCurrency(b.lineValue)}
                    </td>
                    <td className="px-4 py-3">
                      <ExpiryBadge bucket={b.bucket} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
