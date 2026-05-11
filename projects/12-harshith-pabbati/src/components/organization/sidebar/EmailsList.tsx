'use client';

import { useEffect, useReducer, useRef } from 'react';
import { Link, useTransitionRouter } from 'next-view-transitions';
import { usePathname, useSearchParams } from 'next/navigation';
import { getThreads } from '@/actions/email';
import { Tables } from '@/database.types';
import { GearIcon, LightningBoltIcon, MixIcon } from '@radix-ui/react-icons';
import { RealtimeChannel } from '@supabase/supabase-js';

import { createBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

import { Email } from './Email';
import { EmailSkeleton } from './EmailSkeleton';

interface Props {
  orgId: string;
  name: string;
  slug: string;
  inboundEmail: string;
}

type ThreadState = {
  data: Tables<'thread'>[];
  isLoading: boolean;
  status: 'open' | 'closed' | undefined;
};

type ThreadAction =
  | { type: 'FETCH_START' }
  | {
      type: 'FETCH_SUCCESS';
      data: Tables<'thread'>[];
      status: 'open' | 'closed';
    }
  | { type: 'INSERT_THREAD'; thread: Tables<'thread'> };

function threadReducer(state: ThreadState, action: ThreadAction): ThreadState {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, isLoading: true };
    case 'FETCH_SUCCESS':
      return { data: action.data, status: action.status, isLoading: false };
    case 'INSERT_THREAD':
      return { ...state, data: [action.thread, ...state.data] };
  }
}

export function EmailsList({ orgId, name, slug, inboundEmail }: Props) {
  const searchParams = useSearchParams();
  const router = useTransitionRouter();
  const pathname = usePathname();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const statusRef = useRef<'open' | 'closed' | undefined>(undefined);

  const [state, dispatch] = useReducer(threadReducer, {
    data: [],
    isLoading: true,
    status: undefined,
  });

  useEffect(() => {
    // Keep statusRef in sync so the Realtime callback has the latest value
    // without needing to tear down the channel on status changes
    statusRef.current = state.status;
  }, [state.status]);

  useEffect(() => {
    const newStatus =
      searchParams.get('status') === 'closed' ? 'closed' : 'open';
    if (!orgId || state.status === newStatus) return;

    const fetchThreads = async () => {
      dispatch({ type: 'FETCH_START' });
      const { data: threads } = await getThreads(orgId, newStatus);
      dispatch({
        type: 'FETCH_SUCCESS',
        data: threads ?? [],
        status: newStatus,
      });
    };

    fetchThreads();
  }, [orgId, searchParams, state.status]);

  useEffect(() => {
    if (!orgId || channelRef.current) return;

    const supabase = createBrowserClient();
    channelRef.current = supabase
      .channel(`thread:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'thread',
          filter: `organization_id=eq.${orgId}`,
        },
        (payload) => {
          if (statusRef.current === 'closed') return;
          dispatch({
            type: 'INSERT_THREAD',
            thread: payload.new as Tables<'thread'>,
          });
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [orgId]);

  return (
    <div className="max-h-dvh">
      <div className="flex h-[60px] items-center justify-between border-b border-[#FF4500]/20 p-4">
        <h3 className="font-mono truncate font-semibold text-foreground uppercase tracking-wider text-sm">
          {name}
        </h3>
        <div className="flex items-center gap-1.5">
          <Link
            href={`/org/${slug}/workflows`}
            title="Workflows"
            className={cn(
              'flex size-7 items-center justify-center border transition-colors',
              pathname.includes('/workflows')
                ? 'border-[#FF4500] bg-[#FF4500] text-white'
                : 'border-[#FF4500]/30 text-muted-foreground hover:border-[#FF4500] hover:text-[#FF4500]'
            )}
          >
            <LightningBoltIcon className="size-3.5" />
          </Link>
          <Link
            href={`/org/${slug}/sandbox`}
            title="Sandbox"
            className={cn(
              'flex size-7 items-center justify-center border transition-colors',
              pathname === `/org/${slug}/sandbox`
                ? 'border-[#FF4500] bg-[#FF4500] text-white'
                : 'border-[#FF4500]/30 text-muted-foreground hover:border-[#FF4500] hover:text-[#FF4500]'
            )}
          >
            <MixIcon className="size-3.5" />
          </Link>
          <Link
            href={`/org/${slug}/admin`}
            title="Settings"
            className={cn(
              'flex size-7 items-center justify-center border transition-colors',
              pathname === `/org/${slug}/admin`
                ? 'border-[#FF4500] bg-[#FF4500] text-white'
                : 'border-[#FF4500]/30 text-muted-foreground hover:border-[#FF4500] hover:text-[#FF4500]'
            )}
          >
            <GearIcon className="size-3.5" />
          </Link>
          <div className="flex items-center gap-0.5 border border-[#FF4500]/40 p-0.5">
            {(['open', 'closed'] as const).map((s) => {
              const active = (searchParams.get('status') ?? 'open') === s;
              return (
                <button
                  key={s}
                  onClick={() => router.push(`?status=${s}`)}
                  className={cn(
                    'px-2.5 py-0.5 text-xs font-mono font-medium uppercase tracking-wider transition-colors',
                    active
                      ? 'bg-[#FF4500] text-white'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex h-[calc(100dvh-60px-4rem)] flex-col overflow-auto md:h-[calc(100dvh-60px)]">
        {state.isLoading ? (
          Array.from({ length: 10 }).map((_, index) => (
            <EmailSkeleton key={`skeleton-${index}`} />
          ))
        ) : state.data.length > 0 ? (
          state.data.map((e) => <Email key={e.id} slug={slug} {...e} />)
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-4 p-4 text-center">
            <h1 className="font-display text-xl font-black uppercase tracking-tight text-foreground">
              No emails yet
            </h1>
            <p className="font-mono text-muted-foreground text-sm">
              Forward your support emails to the inbound email address to see
              the magic!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
