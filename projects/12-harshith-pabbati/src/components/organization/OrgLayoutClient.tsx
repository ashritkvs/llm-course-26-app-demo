'use client';

import { useParams, usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

import { MobileNav } from './MobileNav';

interface Props {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export function OrgLayoutClient({ sidebar, children }: Props) {
  const params = useParams<{ id?: string }>();
  const pathname = usePathname();
  // Extract the org slug from the pathname: /org/[slug]/...
  const slug = pathname.split('/')[2] ?? '';
  // hasContent: conversation or any full-page sub-route → hide sidebar on mobile, show content.
  // Otherwise (inbox root): show sidebar full-width on mobile.
  // Use exact segment matching (segments[3]) to avoid false positives from slugs
  // that contain sub-route keywords (e.g. slug="admin-billing").
  const subRoute = pathname.split('/')[3] ?? '';
  const hasContent =
    !!params.id ||
    ['workflows', 'admin', 'sandbox', 'dashboard'].includes(subRoute);

  return (
    <div className="flex size-full max-h-dvh max-w-dvw overflow-hidden">
      {/* Sidebar: full-width on mobile (inbox) or hidden (conversation / full-page) */}
      <div
        className={
          hasContent
            ? 'hidden md:flex'
            : 'flex w-full pb-16 md:w-auto md:pb-0'
        }
      >
        {sidebar}
      </div>
      {/* Main content: always gets bottom padding so nothing hides under the fixed nav */}
      <div
        className={cn(
          hasContent ? 'flex-1 pb-16 md:pb-0' : 'hidden flex-1 md:block'
        )}
      >
        {children}
      </div>
      {/* MobileNav is shown on all pages so users can always navigate */}
      <MobileNav slug={slug} />
    </div>
  );
}
