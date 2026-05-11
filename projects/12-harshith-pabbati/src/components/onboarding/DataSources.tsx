'use client';

import { useParams } from 'next/navigation';
import { useTransitionRouter } from 'next-view-transitions';
import { updateOnboardingStep } from '@/actions/auth';

import { AddDataSourceForm } from '@/components/modals/data-source/forms';

export function DataSources() {
  const router = useTransitionRouter();
  const params = useParams<{ slug: string }>();

  const onAdd = async () => {
    await updateOnboardingStep(params.slug, {
      hasOnboarded: true,
      step: 'configurations',
    });
    router.push(`/org/${params.slug}`);
  };

  return (
    <div>
      {/* Step badge */}
      <div className="mb-6 inline-flex items-center gap-2 border border-[#FF4500]/30 bg-[#FF4500]/5 px-3 py-1.5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#FF4500]">
          Step 3 of 4
        </span>
      </div>

      <h2 className="font-display text-4xl font-black uppercase tracking-tight text-foreground">
        Add your
        <br />
        <span className="text-[#FF4500]">data sources</span>
      </h2>
      <p className="font-mono mt-3 text-sm leading-relaxed text-muted-foreground">
        Link your documentation, help center articles, or blogs. Answerify
        learns from these to draft accurate replies.
      </p>

      <div className="mt-2 h-px bg-gradient-to-r from-[#FF4500]/40 to-transparent" />

      <div className="mt-6">
        <AddDataSourceForm onAdd={onAdd} slug={params.slug} />
      </div>
    </div>
  );
}

