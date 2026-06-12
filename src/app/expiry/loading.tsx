import { Skeleton, TableSkeleton } from '@/components/ui';

export default function Loading() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-7 w-40" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <TableSkeleton rows={8} />
    </div>
  );
}
