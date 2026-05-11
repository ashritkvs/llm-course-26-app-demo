import { Skeleton } from '@/components/ui/skeleton';

export default function OrgLoading() {
  return (
    <div className="flex h-screen flex-col overflow-auto">
      {/* Header skeleton */}
      <div className="border-b border-[#FF4500]/20 px-6 py-6 md:px-10">
        <Skeleton className="mb-1 h-2.5 w-24" />
        <Skeleton className="h-9 w-64" />
        {/* Stats row */}
        <div className="mt-5 flex flex-wrap gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 border border-[#FF4500]/20 bg-muted/50 px-4 py-3"
            >
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* Body skeleton */}
      <div className="flex-1 overflow-auto p-6 md:p-10">
        <div className="space-y-6">
          {/* Row 1 – 2 col */}
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-3 border border-[#FF4500]/20 p-5">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>

          {/* Row 2 – 2 col */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3 border border-[#FF4500]/20 p-5">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-full" />
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
            <div className="flex flex-col gap-6">
              {[1, 2].map((i) => (
                <div key={i} className="space-y-3 border border-[#FF4500]/20 p-5">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Row 3 – 4 action cards */}
          <div>
            <Skeleton className="mb-4 h-2.5 w-32" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-4 border border-[#FF4500]/20 p-5">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
