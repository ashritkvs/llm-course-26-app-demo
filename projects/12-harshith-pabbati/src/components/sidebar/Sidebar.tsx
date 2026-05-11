import { Suspense } from 'react';
import { getUser } from '@/actions/auth';
import { getOrganizations } from '@/actions/organization';

import { EmailSkeleton } from '@/components/organization/sidebar/EmailSkeleton';
import { EmailsList } from '@/components/organization/sidebar/EmailsList';

import { ThemeToggle } from '../ui/theme-toggle';
import { CreateOrganization } from './CreateOrganization';
import { Organizations } from './Organizations';
import { User } from './User';

interface Props {
  orgId: string;
  name: string;
  slug: string;
  inboundEmail: string;
}

export async function Sidebar({ orgId, name, slug, inboundEmail }: Props) {
  const {
    data: { user },
  } = await getUser();
  if (!user?.id) return null;

  const organizations = await getOrganizations();

  return (
    <div className="flex h-dvh w-full md:w-auto">
      <div className="bg-background relative flex h-dvh w-16 flex-col items-center justify-between border-r border-[#FF4500]/20">
        <Organizations organizations={organizations} />
        <div className="flex flex-col items-center justify-center gap-2 p-2">
          <CreateOrganization />
          <ThemeToggle />
          <User user={user} />
        </div>
      </div>
      <div className="bg-background border-r-none h-full w-[calc(100dvw-4rem)] md:w-[40dvw] md:border-r md:border-r-[#FF4500]/20 lg:w-[25dvw]">
        <Suspense
          fallback={
            <div className="max-h-dvh">
              <div className="flex h-[60px] items-center justify-between border-b border-[#FF4500]/20 p-4">
                <h3 className="font-mono font-semibold uppercase tracking-wider text-foreground">
                  {name}
                </h3>
              </div>
              <div className="flex h-[calc(100dvh-60px)] flex-col overflow-auto">
                {Array.from({ length: 10 }).map((_, i) => (
                  <EmailSkeleton key={i} />
                ))}
              </div>
            </div>
          }
        >
          <EmailsList
            orgId={orgId}
            name={name}
            slug={slug}
            inboundEmail={inboundEmail}
          />
        </Suspense>
      </div>
    </div>
  );
}
