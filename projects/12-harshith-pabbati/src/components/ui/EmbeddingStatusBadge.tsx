interface Props {
  status: string;
}

export function EmbeddingStatusBadge({ status }: Props) {
  if (status === 'ready') {
    return (
      <span className="ml-auto flex shrink-0 items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-500">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Ready
      </span>
    );
  }
  if (status === 'processing') {
    return (
      <span className="ml-auto flex shrink-0 items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-500">
        <span className="size-1.5 animate-ping rounded-full bg-amber-500" />
        Indexing
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="ml-auto flex shrink-0 items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-red-500">
        <span className="size-1.5 rounded-full bg-red-500" />
        Error
      </span>
    );
  }
  // pending
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400">
      <span className="size-1.5 animate-pulse rounded-full bg-gray-400" />
      Pending
    </span>
  );
}
