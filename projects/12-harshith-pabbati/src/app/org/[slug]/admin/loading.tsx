import { Skeleton } from '@/components/ui/skeleton';

export default function AdminLoading() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div className="flex h-[60px] shrink-0 items-center border-b border-[#FF4500]/20 px-6">
        <div className="space-y-1">
          <Skeleton className="h-2 w-16" />
          <Skeleton className="h-5 w-24" />
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6 md:p-10 space-y-8">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-48 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
