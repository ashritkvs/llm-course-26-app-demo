'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { Link } from 'next-view-transitions';

import { cn } from '@/lib/utils';
import { HumanizedTime } from '@/components/ui/humanized-time';
import { IntentBadge } from '@/components/ui/intent-badge';

interface Props {
  id: string;
  slug: string;
  email_from: string;
  subject: string;
  created_at: string;
  tags?: string[] | null;
}

export function Email({ id, slug, email_from, subject, created_at, tags }: Props) {
  const params = useParams();
  const searchParams = useSearchParams();
  return (
    <Link
      href={`/org/${slug}/${id}?${searchParams.toString()}`}
      className={cn(
        'group border-b border-[#FF4500]/10 px-4 py-3 transition-all duration-200',
        params.id === id 
          ? 'bg-gradient-to-r from-[#FF4500]/10 to-[#FF4500]/5' 
          : 'bg-background hover:bg-gradient-to-r hover:from-[#FF4500]/5 hover:to-transparent'
      )}
    >
      <div className="flex size-full flex-col gap-1 overflow-hidden">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <h3 className="font-mono truncate text-sm font-semibold text-foreground group-hover:text-[#FF4500] transition-colors">
            {subject}
          </h3>
          <HumanizedTime time={created_at} />
        </div>
        <div className="flex min-w-0 items-center justify-between">
          <span className="font-mono truncate text-xs text-muted-foreground">{email_from}</span>
        </div>
        {tags && tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <IntentBadge key={tag} intent={tag} size="sm" />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
