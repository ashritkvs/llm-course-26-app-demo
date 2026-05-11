import { Skeleton } from '@/components/ui/skeleton';

export default function WorkflowsLoading() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header skeleton */}
      <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-[#FF4500]/20 px-6">
        <div className="space-y-1">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      {/* Split layout skeleton */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="w-72 shrink-0 space-y-px border-r border-[#FF4500]/20 p-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2 p-4">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>

        {/* Right panel */}
        <div className="flex-1 space-y-6 p-8">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-64" />
          </div>
          <div className="max-w-lg space-y-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-24 w-full" />
            <div className="flex flex-col items-center gap-1 py-1">
              <div className="h-5 w-px bg-muted" />
              <span className="text-[8px] text-muted">▼</span>
            </div>
            <Skeleton className="h-20 w-full" />
            <div className="flex flex-col items-center gap-1 py-1">
              <div className="h-5 w-px bg-muted" />
              <span className="text-[8px] text-muted">▼</span>
            </div>
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
