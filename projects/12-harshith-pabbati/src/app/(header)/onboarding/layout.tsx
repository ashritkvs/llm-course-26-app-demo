import React from 'react';

import { Steps } from '@/components/onboarding';

export default async function OnboardingLayout({
  children,
}: React.PropsWithChildren<{}>) {
  return (
    <div className="flex size-full bg-background">
      {/* Left sidebar */}
      <div className="relative flex h-full w-[360px] shrink-0 flex-col overflow-hidden border-r border-[#FF4500]/20 bg-[#FF4500]/[0.03]">
        {/* Background grid decoration */}
        <div className="pointer-events-none absolute inset-0 bg-grid bg-[size:24px_24px] opacity-30" />
        {/* Glow accent */}
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-64 w-64 rounded-full bg-[#FF4500]/10 blur-3xl" />
        <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#FF4500]/8 blur-2xl" />

        {/* Steps */}
        <div className="relative z-10 flex flex-1 flex-col justify-center px-8 py-10">
          <p className="font-mono mb-6 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Your progress
          </p>
          <Steps />
        </div>

        {/* Footer note */}
        <div className="relative z-10 border-t border-[#FF4500]/20 p-8">
          <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
            Need help?{' '}
            <a
              href="mailto:support@answerify.com"
              className="text-[#FF4500] underline underline-offset-2"
            >
              Contact support
            </a>
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="relative flex h-full flex-1 flex-col overflow-y-auto">
        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-[#FF4500]/0 via-[#FF4500] to-[#FF4500]/0" />
        <div className="flex flex-1 items-center justify-center p-10 md:p-16">
          <div className="w-full max-w-xl">{children}</div>
        </div>
      </div>
    </div>
  );
}
