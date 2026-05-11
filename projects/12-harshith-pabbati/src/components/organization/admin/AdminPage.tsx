'use client';

import { useMemo, useState, useTransition } from 'react';
import { Link } from 'next-view-transitions';
import { deleteSource, reindexSource } from '@/actions/source';
import type { AdminSource, RecentReply } from '@/actions/source';
import {
  Cross2Icon,
  ExclamationTriangleIcon,
  ExternalLinkIcon,
  Link2Icon,
  ReloadIcon,
  TrashIcon,
} from '@radix-ui/react-icons';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmbeddingStatusBadge } from '@/components/ui/EmbeddingStatusBadge';

interface Props {
  orgId: string;
  slug: string;
  initialSources: AdminSource[];
  initialReplies: RecentReply[];
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center gap-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FF4500]">
        {children}
      </p>
      <div className="h-px flex-1 bg-gradient-to-r from-[#FF4500]/30 to-transparent" />
    </div>
  );
}

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 80
      ? 'text-emerald-500 border-emerald-500/30'
      : pct >= 50
        ? 'text-amber-500 border-amber-500/30'
        : 'text-red-500 border-red-500/30';
  return (
    <span
      className={cn(
        'border px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums',
        color
      )}
    >
      {pct}%
    </span>
  );
}

function ReplyStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    sent: 'text-emerald-500',
    pending: 'text-amber-500',
    draft: 'text-muted-foreground',
  };
  return (
    <span
      className={cn(
        'font-mono text-[10px] font-semibold uppercase tracking-wider',
        map[status] ?? 'text-muted-foreground'
      )}
    >
      {status}
    </span>
  );
}

export function AdminPage({
  orgId,
  slug,
  initialSources,
  initialReplies,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(initialSources.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedSources = initialSources.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const allIds = useMemo(
    () => paginatedSources.map((s) => s.id),
    [paginatedSources]
  );
  const allSelected =
    allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(allIds));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleReindex = (sourceId: string) => {
    startTransition(async () => {
      toast.loading('Re-indexing source…', { id: `reindex-${sourceId}` });
      const { error } = await reindexSource(sourceId, slug);
      if (error) {
        toast.error('Re-index failed', {
          id: `reindex-${sourceId}`,
          description: error instanceof Error ? error.message : String(error),
        });
      } else {
        toast.success('Source re-indexed successfully', {
          id: `reindex-${sourceId}`,
        });
      }
    });
  };

  const REINDEX_CONCURRENCY = 3;

  const handleReindexAll = () => {
    startTransition(async () => {
      const total = initialSources.length;
      let succeeded = 0;
      let failed = 0;
      toast.loading(`Re-indexing sources… (0/${total})`, { id: 'reindex-all' });
      for (let i = 0; i < total; i += REINDEX_CONCURRENCY) {
        const batch = initialSources.slice(i, i + REINDEX_CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map((source) => reindexSource(source.id, slug))
        );
        for (const result of results) {
          if (result.status === 'fulfilled' && !result.value.error) succeeded++;
          else {
            failed++;
            if (result.status === 'rejected')
              console.error('Reindex error:', result.reason);
          }
        }
        const processed = i + batch.length;
        if (processed < total) {
          toast.loading(`Re-indexing sources… (${processed}/${total})`, {
            id: 'reindex-all',
          });
        }
      }
      toast.success(
        `Reindexed ${total} source${total !== 1 ? 's' : ''} — ${succeeded} succeeded, ${failed} failed`,
        { id: 'reindex-all' }
      );
    });
  };

  const handleReindexSelected = () => {
    const ids = Array.from(selected);
    startTransition(async () => {
      const total = ids.length;
      let succeeded = 0;
      let failed = 0;
      toast.loading(`Re-indexing selected sources… (0/${total})`, {
        id: 'reindex-selected',
      });
      for (let i = 0; i < total; i += REINDEX_CONCURRENCY) {
        const batch = ids.slice(i, i + REINDEX_CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map((id) => reindexSource(id, slug))
        );
        for (const result of results) {
          if (result.status === 'fulfilled' && !result.value.error) succeeded++;
          else {
            failed++;
            if (result.status === 'rejected')
              console.error('Reindex error:', result.reason);
          }
        }
        const processed = i + batch.length;
        if (processed < total) {
          toast.loading(
            `Re-indexing selected sources… (${processed}/${total})`,
            { id: 'reindex-selected' }
          );
        }
      }
      toast.success(
        `Reindexed ${total} source${total !== 1 ? 's' : ''} — ${succeeded} succeeded, ${failed} failed`,
        { id: 'reindex-selected' }
      );
      setSelected(new Set());
    });
  };

  const handleDelete = (sourceId: string) => {
    startTransition(async () => {
      const { error } = await deleteSource(sourceId, slug);
      if (error) {
        toast.error('Delete failed', {
          description: error instanceof Error ? error.message : String(error),
        });
      } else {
        toast.success('Data source deleted');
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(sourceId);
          return next;
        });
      }
    });
  };

  const zeroSectionSources = initialSources.filter(
    (s) => s.status === 'ready' && s.section_count === 0
  );

  return (
    <div className="flex h-full flex-col overflow-auto">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="relative border-b border-[#FF4500]/20 px-6 py-6 md:px-10 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(#FF4500 1px, transparent 1px), linear-gradient(90deg, #FF4500 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-[#FF4500]">
          {'// ADMIN'}
        </p>
        <h1 className="font-display text-3xl font-black uppercase tracking-tight text-foreground">
          Admin Panel
        </h1>
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          Monitor datasource health, reindex stuck sources, and review AI reply
          logs.
        </p>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6 md:p-10">
        <div className="space-y-10">
          {/* ── Datasource Health ──────────────────────────────────────────── */}
          <div>
            <SectionLabel>{`// Datasource Health`}</SectionLabel>
            <Card className="border-[#FF4500]/15">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>📚 Datasource Health</CardTitle>
                    <CardDescription>
                      All data sources for this organization with their indexing
                      status and section counts. Use the actions to reindex
                      stuck or errored sources, or delete them entirely.
                    </CardDescription>
                  </div>
                  {initialSources.length > 0 && (
                    <div className="flex items-center gap-2">
                      {someSelected && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={handleReindexSelected}
                          className="gap-1.5 text-xs"
                        >
                          <ReloadIcon className="size-3" />
                          Reindex Selected ({selected.size})
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={handleReindexAll}
                        className="gap-1.5 text-xs"
                      >
                        <ReloadIcon className="size-3" />
                        Reindex All
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {zeroSectionSources.length > 0 && (
                  <div className="mb-4 flex items-start gap-2 border border-amber-500/40 bg-amber-500/5 px-4 py-3">
                    <ExclamationTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-500" />
                    <div>
                      <p className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
                        {zeroSectionSources.length} source
                        {zeroSectionSources.length !== 1 ? 's' : ''} indexed
                        with 0 sections
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                        This usually means the page returned no readable content
                        (e.g. JavaScript-rendered SPA, empty response, or the
                        content has no headings). Try reindexing — if it stays
                        at 0 sections the URL may not be scrapable.
                      </p>
                    </div>
                  </div>
                )}
                {initialSources.length === 0 ? (
                  <p className="font-mono text-sm text-muted-foreground py-4 text-center">
                    No data sources configured yet.
                  </p>
                ) : (
                  <>
                    {/* ── Mobile card list ───────────────────────────────── */}
                    <div className="space-y-3 md:hidden">
                      {paginatedSources.map((source) => {
                        const isEmptyReady =
                          source.status === 'ready' &&
                          source.section_count === 0;
                        return (
                          <div
                            key={source.id}
                            className={cn(
                              'space-y-2 border border-[#FF4500]/15 p-3 font-mono text-xs',
                              isEmptyReady && 'bg-amber-500/5',
                              selected.has(source.id) && 'bg-[#FF4500]/5'
                            )}
                          >
                            <div className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                checked={selected.has(source.id)}
                                onChange={() => toggleOne(source.id)}
                                className="mt-0.5 cursor-pointer accent-[#FF4500]"
                                aria-label={`Select ${source.url}`}
                              />
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex min-w-0 flex-1 items-center gap-1.5 text-foreground hover:text-[#FF4500] transition-colors"
                              >
                                <Link2Icon className="size-3 shrink-0" />
                                <span className="truncate">{source.url}</span>
                                <ExternalLinkIcon className="size-3 shrink-0 opacity-50" />
                              </a>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-5">
                              <EmbeddingStatusBadge status={source.status} />
                              <span className="text-muted-foreground">
                                {isEmptyReady ? (
                                  <span className="flex items-center gap-1 text-amber-500 font-semibold">
                                    <ExclamationTriangleIcon className="size-3" />
                                    0 sections
                                  </span>
                                ) : (
                                  <>{source.section_count} sections</>
                                )}
                              </span>
                              <span
                                className="text-muted-foreground"
                                suppressHydrationWarning
                              >
                                {new Date(source.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 pl-5">
                              <Button
                                variant="neutral"
                                size="sm"
                                disabled={isPending}
                                onClick={() => handleReindex(source.id)}
                                className="gap-1.5 text-xs"
                              >
                                <ReloadIcon className="size-3" />
                                Reindex
                              </Button>
                              <Button
                                variant="neutral"
                                size="sm"
                                disabled={isPending}
                                onClick={() => handleDelete(source.id)}
                                className="gap-1.5 text-xs text-red-500 hover:text-red-600"
                              >
                                <TrashIcon className="size-3" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* ── Desktop table ──────────────────────────────────── */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm font-mono">
                        <thead>
                          <tr className="border-b border-[#FF4500]/20 text-left">
                            <th className="pb-3 pr-4 w-8">
                              <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={toggleAll}
                                className="cursor-pointer accent-[#FF4500]"
                                aria-label="Select all sources on this page"
                              />
                            </th>
                            <th className="pb-3 pr-4 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
                              URL
                            </th>
                            <th className="pb-3 pr-4 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground whitespace-nowrap">
                              Status
                            </th>
                            <th className="pb-3 pr-4 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground whitespace-nowrap">
                              Sections
                            </th>
                            <th className="pb-3 pr-4 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground whitespace-nowrap">
                              Indexed At
                            </th>
                            <th className="pb-3 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#FF4500]/10">
                          {paginatedSources.map((source) => {
                            const isEmptyReady =
                              source.status === 'ready' &&
                              source.section_count === 0;
                            return (
                              <tr
                                key={source.id}
                                className={cn(
                                  'group',
                                  isEmptyReady && 'bg-amber-500/5',
                                  selected.has(source.id) && 'bg-[#FF4500]/5'
                                )}
                              >
                                <td className="py-3 pr-4">
                                  <input
                                    type="checkbox"
                                    checked={selected.has(source.id)}
                                    onChange={() => toggleOne(source.id)}
                                    className="cursor-pointer accent-[#FF4500]"
                                    aria-label={`Select ${source.url}`}
                                  />
                                </td>
                                <td className="py-3 pr-4 max-w-xs">
                                  <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-foreground hover:text-[#FF4500] transition-colors truncate"
                                  >
                                    <Link2Icon className="size-3 shrink-0" />
                                    <span className="truncate">{source.url}</span>
                                    <ExternalLinkIcon className="size-3 shrink-0 opacity-50" />
                                  </a>
                                </td>
                                <td className="py-3 pr-4">
                                  <EmbeddingStatusBadge status={source.status} />
                                </td>
                                <td className="py-3 pr-4 tabular-nums">
                                  {isEmptyReady ? (
                                    <span className="flex items-center gap-1 text-amber-500 font-semibold">
                                      <ExclamationTriangleIcon className="size-3" />
                                      0
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      {source.section_count}
                                    </span>
                                  )}
                                </td>
                                <td
                                  className="py-3 pr-4 whitespace-nowrap text-muted-foreground text-xs"
                                  suppressHydrationWarning
                                >
                                  {new Date(source.created_at).toLocaleString()}
                                </td>
                                <td className="py-3">
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="neutral"
                                      size="sm"
                                      disabled={isPending}
                                      onClick={() => handleReindex(source.id)}
                                      title="Re-index this source"
                                      className="gap-1.5 text-xs"
                                    >
                                      <ReloadIcon className="size-3" />
                                      Reindex
                                    </Button>
                                    <Button
                                      variant="neutral"
                                      size="sm"
                                      disabled={isPending}
                                      onClick={() => handleDelete(source.id)}
                                      title="Delete this source"
                                      className="gap-1.5 text-xs text-red-500 hover:text-red-600"
                                    >
                                      <TrashIcon className="size-3" />
                                      Delete
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {totalPages > 1 && (
                      <div className="mt-4 flex items-center justify-between font-mono text-xs text-muted-foreground">
                        <span>
                          Page {safePage} of {totalPages} &mdash;{' '}
                          {initialSources.length} total
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={safePage === 1 || isPending}
                            onClick={() => setCurrentPage((p) => p - 1)}
                            className="text-xs"
                          >
                            ← Prev
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={safePage === totalPages || isPending}
                            onClick={() => setCurrentPage((p) => p + 1)}
                            className="text-xs"
                          >
                            Next →
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Reply Logs ─────────────────────────────────────────────────── */}
          <div>
            <SectionLabel>{`// Reply Logs`}</SectionLabel>
            <Card className="border-[#FF4500]/15">
              <CardHeader>
                <CardTitle>📋 Recent AI Reply Logs</CardTitle>
                <CardDescription>
                  The last 20 AI-generated replies across all threads, with
                  confidence scores and delivery status.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {initialReplies.length === 0 ? (
                  <p className="font-mono text-sm text-muted-foreground py-4 text-center">
                    No replies generated yet.
                  </p>
                ) : (
                  <>
                    {/* ── Mobile card list ───────────────────────────────── */}
                    <div className="space-y-3 md:hidden">
                      {initialReplies.map((reply) => (
                        <div
                          key={reply.id}
                          className="space-y-2 border border-[#FF4500]/15 p-3 font-mono text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <Link
                              href={`/org/${slug}/${reply.thread_id}`}
                              className="text-foreground hover:text-[#FF4500] transition-colors font-medium underline underline-offset-2"
                            >
                              Thread {reply.thread_id.slice(0, 8)}…
                            </Link>
                            <ReplyStatusBadge status={reply.status} />
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
                            <ConfidenceBadge score={reply.confidence_score} />
                            <span>
                              {reply.is_perfect === true ? (
                                <span className="text-emerald-500 font-bold">✓ Perfect</span>
                              ) : reply.is_perfect === false ? (
                                <span className="text-red-500">✗ Not perfect</span>
                              ) : (
                                '—'
                              )}
                            </span>
                            <span suppressHydrationWarning>
                              {new Date(reply.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* ── Desktop table ──────────────────────────────────── */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm font-mono">
                        <thead>
                          <tr className="border-b border-[#FF4500]/20 text-left">
                            <th className="pb-3 pr-4 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
                              Thread
                            </th>
                            <th className="pb-3 pr-4 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground whitespace-nowrap">
                              Confidence
                            </th>
                            <th className="pb-3 pr-4 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
                              Status
                            </th>
                            <th className="pb-3 pr-4 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground whitespace-nowrap">
                              Perfect?
                            </th>
                            <th className="pb-3 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground whitespace-nowrap">
                              Created At
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#FF4500]/10">
                          {initialReplies.map((reply) => (
                            <tr key={reply.id} className="group">
                              <td className="py-3 pr-4">
                                <Link
                                  href={`/org/${slug}/${reply.thread_id}`}
                                  className="text-foreground hover:text-[#FF4500] transition-colors font-medium underline underline-offset-2"
                                >
                                  {reply.thread_id.slice(0, 8)}…
                                </Link>
                              </td>
                              <td className="py-3 pr-4">
                                <ConfidenceBadge score={reply.confidence_score} />
                              </td>
                              <td className="py-3 pr-4">
                                <ReplyStatusBadge status={reply.status} />
                              </td>
                              <td className="py-3 pr-4">
                                {reply.is_perfect === true ? (
                                  <span className="text-emerald-500 font-bold">
                                    ✓
                                  </span>
                                ) : reply.is_perfect === false ? (
                                  <Cross2Icon className="size-3 text-red-500" />
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td
                                className="py-3 whitespace-nowrap text-muted-foreground text-xs"
                                suppressHydrationWarning
                              >
                                {new Date(reply.created_at).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
