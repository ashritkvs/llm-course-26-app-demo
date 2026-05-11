'use client';

import { useTransitionRouter } from 'next-view-transitions';
import { updateOnboardingStep } from '@/actions/auth';
import {
  ArrowRightIcon,
  CheckIcon,
  ClipboardCopyIcon,
} from '@radix-ui/react-icons';

import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { Button } from '@/components/ui/button';

interface Props {
  email: string;
  slug: string;
}

const EMAIL_PROVIDERS = [
  { name: 'Gmail', href: 'https://support.google.com/mail/answer/10957' },
  { name: 'Google Workspace', href: 'https://support.google.com/a/answer/10486484' },
  {
    name: 'Microsoft 365',
    href: 'https://docs.microsoft.com/en-us/microsoft-365/admin/email/configure-email-forwarding?view=o365-worldwide',
  },
  {
    name: 'Microsoft Exchange',
    href: 'https://docs.microsoft.com/en-us/exchange/recipients/user-mailboxes/email-forwarding?view=exchserver-2019',
  },
];

export function EmailForwarding({ email, slug }: Props) {
  const router = useTransitionRouter();
  const { copied, copyToClipboard } = useCopyToClipboard();

  const handleOnSetupForwarding = async () => {
    await updateOnboardingStep(slug, {
      hasOnboarded: false,
      step: 'data-sources',
    });
    router.push(`/onboarding/${slug}/data-sources`);
  };

  return (
    <div>
      {/* Step badge */}
      <div className="mb-6 inline-flex items-center gap-2 border border-[#FF4500]/30 bg-[#FF4500]/5 px-3 py-1.5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#FF4500]">
          Step 2 of 4
        </span>
      </div>

      <h2 className="font-display text-4xl font-black uppercase tracking-tight text-foreground">
        Setup email
        <br />
        <span className="text-[#FF4500]">forwarding</span>
      </h2>
      <p className="font-mono mt-3 text-sm leading-relaxed text-muted-foreground">
        Forward emails from your support inbox to Answerify so we can
        automatically draft replies.
      </p>

      <div className="mt-2 h-px bg-gradient-to-r from-[#FF4500]/40 to-transparent" />

      {/* Inbound address */}
      <div className="mt-6">
        <p className="font-mono mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Your Answerify inbound address
        </p>
        <div className="flex items-center justify-between gap-3 border border-[#FF4500]/30 bg-[#FF4500]/5 p-4">
          <p className="font-mono truncate text-sm font-semibold text-foreground">
            {email}
          </p>
          <Button
            variant="neutral"
            size="icon"
            className="shrink-0"
            onClick={() => copyToClipboard(email)}
            title="Copy address"
          >
            {copied ? (
              <CheckIcon className="text-[#FF4500]" />
            ) : (
              <ClipboardCopyIcon />
            )}
          </Button>
        </div>
        <p className="font-mono mt-2 text-[11px] text-muted-foreground/70">
          Forward all incoming support emails to this address.
        </p>
      </div>

      {/* Provider links */}
      <div className="mt-6">
        <p className="font-mono mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Setup guide for your email provider
        </p>
        <div className="grid grid-cols-2 gap-2">
          {EMAIL_PROVIDERS.map((provider) => (
            <a
              key={provider.name}
              href={provider.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between border border-border p-3 font-mono text-xs font-semibold text-foreground transition-colors hover:border-[#FF4500]/50 hover:bg-[#FF4500]/5 hover:text-[#FF4500]"
            >
              <span>{provider.name}</span>
              <ArrowRightIcon className="ml-1 shrink-0 opacity-50" />
            </a>
          ))}
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <Button onClick={handleOnSetupForwarding} size="lg">
          Continue
          <ArrowRightIcon className="ml-2" />
        </Button>
      </div>
    </div>
  );
}

