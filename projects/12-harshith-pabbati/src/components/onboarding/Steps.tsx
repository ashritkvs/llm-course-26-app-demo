'use client';

import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const STEPS = [
  { title: 'Create organization', description: 'Name your workspace', route: 'onboarding' },
  { title: 'Email forwarding', description: 'Connect your support inbox', route: 'email-forwarding' },
  { title: 'Data sources', description: 'Add your knowledge base', route: 'data-sources' },
  { title: 'Configurations', description: 'Finalise your setup', route: 'configurations' },
];

interface StepProps {
  index: number;
  title: string;
  description: string;
  current: boolean;
  completed: boolean;
  isLast: boolean;
}

function Step({ title, description, current, completed, index, isLast }: StepProps) {
  return (
    <div className="flex items-start gap-4">
      {/* Circle + connector */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'relative flex h-9 w-9 shrink-0 items-center justify-center border-2 font-mono text-sm font-bold transition-all duration-300',
            current
              ? 'border-[#FF4500] bg-[#FF4500] text-white shadow-[0_0_16px_rgba(255,69,0,0.45)]'
              : completed
                ? 'border-[#FF4500] bg-[#FF4500]/10 text-[#FF4500]'
                : 'border-muted-foreground/30 bg-transparent text-muted-foreground/50'
          )}
        >
          {completed ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
              <path d="M2.5 7l3.5 3.5 5.5-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <span>{index}</span>
          )}
          {current && (
            <span className="absolute -inset-1 animate-ping rounded-none border border-[#FF4500]/50 opacity-75" />
          )}
        </div>
        {!isLast && (
          <div
            className={cn(
              'mt-1 w-px flex-1 transition-all duration-500',
              completed ? 'bg-[#FF4500]/40' : 'bg-muted-foreground/15'
            )}
            style={{ height: '32px' }}
          />
        )}
      </div>

      {/* Text */}
      <div className={cn('pb-2 pt-1 transition-all duration-300', isLast ? '' : 'mb-0')}>
        <p
          className={cn(
            'font-mono text-[11px] font-semibold uppercase tracking-widest',
            current ? 'text-[#FF4500]' : completed ? 'text-[#FF4500]/60' : 'text-muted-foreground/40'
          )}
        >
          Step {index}
        </p>
        <h3
          className={cn(
            'mt-0.5 font-display text-base font-black uppercase tracking-tight leading-tight',
            current ? 'text-foreground' : completed ? 'text-foreground/60' : 'text-muted-foreground/40'
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            'mt-0.5 font-mono text-[11px]',
            current ? 'text-muted-foreground' : 'text-muted-foreground/30'
          )}
        >
          {description}
        </p>
      </div>
    </div>
  );
}

export function Steps() {
  const pathname = usePathname();
  const last = pathname.split('/').at(-1);

  const currentIndex = STEPS.findIndex((s) => s.route === last);

  return (
    <div className="flex flex-col">
      {STEPS.map((step, index) => (
        <Step
          key={step.route}
          index={index + 1}
          title={step.title}
          description={step.description}
          current={currentIndex === index}
          completed={index < currentIndex}
          isLast={index === STEPS.length - 1}
        />
      ))}
    </div>
  );
}
