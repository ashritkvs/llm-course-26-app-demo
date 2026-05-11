import * as React from 'react';

import { cn } from '@/lib/utils';

const INTENT_CONFIG: Record<
  string,
  {
    icon: string;
    className: string;
  }
> = {
  Billing: {
    icon: '💳',
    className: 'bg-blue-500/15 border-blue-500/50 text-blue-400',
  },
  'Bug Report': {
    icon: '🐛',
    className: 'bg-red-500/15 border-red-500/50 text-red-400',
  },
  'Feature Request': {
    icon: '✨',
    className: 'bg-purple-500/15 border-purple-500/50 text-purple-400',
  },
  'General Support': {
    icon: '💬',
    className: 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400',
  },
  'Account Access': {
    icon: '🔐',
    className: 'bg-cyan-500/15 border-cyan-500/50 text-cyan-400',
  },
  'Account Settings': {
    icon: '⚙️',
    className: 'bg-cyan-500/15 border-cyan-500/50 text-cyan-400',
  },
  'Account Deletion': {
    icon: '🗑️',
    className: 'bg-gray-500/15 border-gray-500/50 text-gray-400',
  },
  'Refund Request': {
    icon: '💰',
    className: 'bg-amber-500/15 border-amber-500/50 text-amber-400',
  },
  'Payment Failed': {
    icon: '❌',
    className: 'bg-orange-500/15 border-orange-500/50 text-orange-400',
  },
  'Subscription Change': {
    icon: '🔄',
    className: 'bg-indigo-500/15 border-indigo-500/50 text-indigo-400',
  },
  'Invoice Request': {
    icon: '📄',
    className: 'bg-slate-500/15 border-slate-500/50 text-slate-400',
  },
  'Performance Issue': {
    icon: '⚡',
    className: 'bg-yellow-500/15 border-yellow-500/50 text-yellow-400',
  },
  'Integration Issue': {
    icon: '🔌',
    className: 'bg-teal-500/15 border-teal-500/50 text-teal-400',
  },
  'Data Export': {
    icon: '📤',
    className: 'bg-green-500/15 border-green-500/50 text-green-400',
  },
  'Upgrade Inquiry': {
    icon: '🚀',
    className: 'bg-violet-500/15 border-violet-500/50 text-violet-400',
  },
  'Demo Request': {
    icon: '🎯',
    className: 'bg-pink-500/15 border-pink-500/50 text-pink-400',
  },
  'Onboarding Help': {
    icon: '🎓',
    className: 'bg-cyan-500/15 border-cyan-500/50 text-cyan-400',
  },
  'How-To Question': {
    icon: '❓',
    className: 'bg-sky-500/15 border-sky-500/50 text-sky-400',
  },
  'Security Concern': {
    icon: '🛡️',
    className: 'bg-red-600/15 border-red-600/50 text-red-500',
  },
  'Abuse Report': {
    icon: '🚫',
    className: 'bg-red-700/15 border-red-700/50 text-red-600',
  },
  'Privacy Request': {
    icon: '🔒',
    className: 'bg-slate-600/15 border-slate-600/50 text-slate-500',
  },
  Complaint: {
    icon: '😤',
    className: 'bg-rose-500/15 border-rose-500/50 text-rose-400',
  },
  Compliment: {
    icon: '🌟',
    className: 'bg-yellow-400/15 border-yellow-400/50 text-yellow-300',
  },
  'Spam / Irrelevant': {
    icon: '🚮',
    className: 'bg-gray-600/15 border-gray-600/50 text-gray-500',
  },
  escalated: {
    icon: '🚨',
    className: 'bg-[#FF4500]/15 border-[#FF4500]/50 text-[#FF4500]',
  },
};

interface IntentBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  intent: string;
  size?: 'sm' | 'md';
}

export function IntentBadge({
  intent,
  size = 'sm',
  className,
  ...props
}: IntentBadgeProps) {
  const config = INTENT_CONFIG[intent];

  if (!config) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 border bg-muted/50 font-mono font-medium uppercase tracking-wide transition-all',
          size === 'sm' ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-xs',
          'border-muted-foreground/30 text-muted-foreground',
          className
        )}
        {...props}
      >
        🏷️ {intent}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 border font-mono font-medium uppercase tracking-wide transition-all hover:brightness-110',
        size === 'sm' ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-xs',
        config.className,
        className
      )}
      {...props}
    >
      <span>{config.icon}</span>
      <span>{intent}</span>
    </span>
  );
}

export { INTENT_CONFIG };
