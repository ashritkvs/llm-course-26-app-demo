import { Metadata } from 'next';
import { getOrganizations } from '@/actions/organization';
import { Link } from 'next-view-transitions';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import {
  CreateNewOrganizationButton,
  EmptyState,
} from '@/components/dashboard';

export const metadata: Metadata = {
  title: 'Dashboard',
};

// Revalidate every 60 seconds to keep dashboard fresh
export const revalidate = 60;

// Deterministic dark palette for the initial-letter block on each org card
const PALETTE = ['#FF4500', '#FF6A00', '#CC3700', '#E63E00', '#FF5722'];
function orgColor(name: string) {
  return PALETTE[name.charCodeAt(0) % PALETTE.length];
}

export default async function DashboardPage() {
  const organizations = await getOrganizations();

  return (
    <div className="flex h-full flex-col overflow-auto">
      {organizations.length > 0 ? (
        <>
          {/* Dark header with orange grid background */}
          <div className="relative border-b border-[#FF4500]/30 bg-background px-6 py-10 md:px-10 overflow-hidden">
            <div
              className="pointer-events-none absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  'linear-gradient(to right, #FF4500 1px, transparent 1px), linear-gradient(to bottom, #FF4500 1px, transparent 1px)',
                backgroundSize: '60px 60px',
              }}
            />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FF4500] mb-2">
                  {`// WORKSPACE`}
                </p>
                <h1 className="font-display text-4xl font-black uppercase tracking-tight text-foreground">
                  Your organizations
                </h1>
                <p className="font-mono mt-1 text-sm text-muted-foreground">
                  {organizations.length} workspace
                  {organizations.length !== 1 ? 's' : ''} &mdash; pick one to
                  get started
                </p>
              </div>
              <CreateNewOrganizationButton />
            </div>
          </div>

          {/* Org grid */}
          <div className="p-6 md:p-10">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {organizations.map((o: any) => {
                const hasOnboarded = !!(o?.onboarding as any)?.hasOnboarded;
                const href = hasOnboarded
                  ? `/org/${o.slug}`
                  : `/onboarding/${o.slug}/${(o.onboarding as any)?.step}`;
                const initial = o.name.charAt(0).toUpperCase();
                const bg = orgColor(o.name);

                return (
                  <Link href={href} key={o.slug}>
                    <Card className="flex h-full flex-col transition-all hover:border-[#FF4500]/80">
                      {/* Colored block with large initial */}
                      <div
                        className="flex h-24 items-center border-b border-[#FF4500]/40 px-6"
                        style={{ backgroundColor: bg + '22' }}
                      >
                        <span
                          className="font-display text-5xl font-black uppercase"
                          style={{ color: bg }}
                        >
                          {initial}
                        </span>
                      </div>

                      <CardContent className="flex flex-1 flex-col gap-2 p-5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h2 className="font-display text-lg font-black uppercase tracking-tight text-foreground leading-snug">
                              {o.name}
                            </h2>
                            <p className="font-mono truncate text-xs text-muted-foreground">
                              {o.support_email}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'font-mono shrink-0 border px-2 py-0.5 text-xs font-bold uppercase tracking-widest',
                              hasOnboarded
                                ? 'border-[#FF4500] text-[#FF4500] bg-[#FF4500]/10'
                                : 'border-gray-600 text-gray-400'
                            )}
                          >
                            {hasOnboarded ? 'Live' : 'Setup'}
                          </span>
                        </div>
                        <p className="font-mono mt-auto text-xs text-muted-foreground tabular-nums">
                          Created{' '}
                          {new Date(o.created_at).toLocaleDateString(
                            undefined,
                            { year: 'numeric', month: 'short', day: 'numeric' }
                          )}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
