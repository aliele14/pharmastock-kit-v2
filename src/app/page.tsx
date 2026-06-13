import { getDashboardData, getSuppliers } from '@/lib/db/queries';
import { DashboardView } from '@/components/dashboard/dashboard-view';

// Always reflect the latest sandbox state.
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [{ products, batchesByProduct, demandByProduct, anomaliesByProduct }, suppliers] =
    await Promise.all([getDashboardData(), getSuppliers()]);

  return (
    <DashboardView
      products={products}
      batchesByProduct={batchesByProduct}
      demandByProduct={demandByProduct}
      anomaliesByProduct={anomaliesByProduct}
      suppliers={suppliers}
    />
  );
}
