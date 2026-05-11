'use client';

import { useCreateOrganization } from '@/states/organization';
import { PlusIcon, RocketIcon } from '@radix-ui/react-icons';

import { Button } from '@/components/ui/button';

export function EmptyState() {
  const [, setCreateOrg] = useCreateOrganization();

  return (
    <div className="flex size-full flex-col items-center justify-center gap-6 px-6 py-20 text-center">
      {/* Icon badge */}
      <div className="flex size-20 items-center justify-center border border-[#FF4500] bg-[#FF4500]/10">
        <RocketIcon className="size-9 text-[#FF4500]" />
      </div>

      {/* Text */}
      <div className="max-w-sm space-y-2">
        <h1 className="font-display text-2xl font-black uppercase tracking-tight text-foreground">
          No organizations yet
        </h1>
        <p className="font-mono text-sm text-muted-foreground">
          Create your first organization and let Answerify handle support emails
          automatically — powered by AI.
        </p>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap justify-center gap-2">
        {['INBOUND EMAIL', 'AI REPLIES', 'KNOWLEDGE BASE', 'AUTOPILOT'].map(
          (f) => (
            <span
              key={f}
              className="font-mono border border-[#FF4500]/40 bg-background px-3 py-1 text-xs font-semibold tracking-widest text-[#FF4500]"
            >
              {f}
            </span>
          )
        )}
      </div>

      {/* CTA */}
      <Button onClick={() => setCreateOrg(true)} size="lg">
        <PlusIcon className="mr-2 size-4" />
        Create organization
      </Button>
    </div>
  );
}
