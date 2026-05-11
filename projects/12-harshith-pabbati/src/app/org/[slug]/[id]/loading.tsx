import { Skeleton } from '@/components/ui/skeleton';

export default function EmailLoading() {
  return (
    <div className="max-h-dvh overflow-hidden">
      {/* Header skeleton */}
      <div className="bg-background flex h-[60px] items-center gap-2 border-b px-2 py-2 md:px-4">
        <div className="flex-1 space-y-1">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>

      {/* Conversations skeleton */}
      <div className="flex h-[calc(100dvh-4rem)] flex-col">
        <div className="flex-1 space-y-4 overflow-hidden p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className={`flex gap-3 ${i % 2 !== 0 ? 'flex-row-reverse' : ''}`}
            >
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <Skeleton
                className={`h-24 rounded-base ${i % 2 !== 0 ? 'w-1/2' : 'w-2/3'}`}
              />
            </div>
          ))}
        </div>
        <div className="border-t p-4">
          <Skeleton className="h-40 w-full rounded-base" />
          <div className="mt-4 flex justify-end gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-36" />
          </div>
        </div>
      </div>
    </div>
  );
}
