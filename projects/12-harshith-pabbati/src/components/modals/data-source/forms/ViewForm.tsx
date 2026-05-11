import { fetchSources } from '@/actions/source';
import { useQuery } from '@tanstack/react-query';
import { Link2Icon } from '@radix-ui/react-icons';

import { cn } from '@/lib/utils';
import { sourcesQueryKey } from '@/lib/query-keys';
import { Tables } from '@/database.types';
import { EmbeddingStatusBadge } from '@/components/ui/EmbeddingStatusBadge';

interface Props {
  orgId: string;
}

export function ViewDataSourcesForm({ orgId }: Props) {
  const { data = [] } = useQuery<Tables<'datasource'>[]>({
    queryKey: sourcesQueryKey(orgId),
    queryFn: () => fetchSources(orgId),
    enabled: Boolean(orgId),
    // Keep polling while any source is still being indexed
    refetchInterval: (query) => {
      const sources = (query.state.data ?? []) as Tables<'datasource'>[];
      const hasProcessing = sources.some(
        (s) => s.status === 'pending' || s.status === 'processing'
      );
      return hasProcessing ? 4_000 : false;
    },
  });

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground py-4 text-center text-sm">
        No data sources configured yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2 size-full overflow-x-auto max-h-96">
      {data.map((source) => (
        <li key={source.id}>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open data source: ${source.url}`}
            className={cn(
              'flex items-center gap-2 border bg-muted px-3 py-2 text-sm font-mono font-medium text-foreground transition-all',
              source.status === 'ready'
                ? 'border-[#FF4500]/20 hover:border-[#FF4500]/60'
                : source.status === 'error'
                  ? 'border-red-500/30 hover:border-red-500/60'
                  : 'border-amber-500/30 hover:border-amber-500/60'
            )}
          >
            <Link2Icon className="size-3.5 shrink-0" />
            <span className="truncate">{source.url}</span>
            <EmbeddingStatusBadge status={source.status} />
          </a>
        </li>
      ))}
    </ul>
  );
}
