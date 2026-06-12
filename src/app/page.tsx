import { getDashboardData } from '@/lib/db/queries';
import { DashboardView } from '@/components/dashboard/dashboard-view';

// Always reflect the latest sandbox state.
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { products, batchesByProduct } = await getDashboardData();
  return <DashboardView products={products} batchesByProduct={batchesByProduct} />;
}
