'use client';

import { useTransitionRouter } from 'next-view-transitions';
import { updateOnboardingStep } from '@/actions/auth';

import { CreateOrganizationForm } from '@/components/modals/organization/forms';

export function Organization() {
  const router = useTransitionRouter();

  const handleOnCreate = async (slug: string) => {
    await updateOnboardingStep(slug, {
      hasOnboarded: false,
      step: 'email-forwarding',
    });
    router.push(`/onboarding/${slug}/email-forwarding`);
  };

  return (
    <div>
      {/* Step badge */}
      <div className="mb-6 inline-flex items-center gap-2 border border-[#FF4500]/30 bg-[#FF4500]/5 px-3 py-1.5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#FF4500]">
          Step 1 of 4
        </span>
      </div>

      <h2 className="font-display text-4xl font-black uppercase tracking-tight text-foreground">
        Create your
        <br />
        <span className="text-[#FF4500]">organization</span>
      </h2>
      <p className="font-mono mt-3 text-sm leading-relaxed text-muted-foreground">
        Give your workspace a name. This is how your team will identify your
        Answerify account.
      </p>

      <div className="mt-2 h-px bg-gradient-to-r from-[#FF4500]/40 to-transparent" />

      <div className="mt-6">
        <CreateOrganizationForm onCreate={handleOnCreate} />
      </div>
    </div>
  );
}

