import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-7 w-44" />
      <Skeleton className="h-4 w-72" />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
    </div>
  );
}
