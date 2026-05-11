'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function EmailSkeleton() {
  return (
    <div className="flex items-center gap-2 border-b px-2 py-3">
      <Skeleton className="size-12 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-[250px]" />
        <Skeleton className="h-3 w-[200px]" />
      </div>
    </div>
  );
}
