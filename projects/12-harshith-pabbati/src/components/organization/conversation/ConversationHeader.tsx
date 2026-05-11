import { Link } from 'next-view-transitions';
import { ArrowLeftIcon } from '@radix-ui/react-icons';

import { Badge } from '@/components/ui/badge';

interface Props {
  subject: string;
  email_from: string;
  status: string;
  slug: string;
}

export function ConversationHeader({
  subject,
  email_from,
  status,
  slug,
}: Props) {
  return (
    <div className="bg-gradient-to-b from-[#FF4500]/5 to-transparent border-b border-[#FF4500]/20 h-[60px] flex items-center justify-between px-2 md:px-4 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        <Link
          href={`/org/${slug}`}
          className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-[#FF4500] hover:bg-[#FF4500]/10 transition-all"
          aria-label="Back to inbox"
        >
          <ArrowLeftIcon className="size-5" />
        </Link>
        <div className="flex min-w-0 flex-col gap-0.5 max-w-xs md:max-w-none">
          <h3 className="font-mono text-foreground truncate font-bold uppercase tracking-wide text-sm md:text-base">{subject}</h3>
          <div className="flex items-center gap-2">
            <span className="font-mono text-muted-foreground truncate text-[10px] md:text-xs">{email_from}</span>
            {status === 'closed' && (
              <Badge className="px-1.5 py-0.5 text-[9px] font-semibold">Closed</Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
