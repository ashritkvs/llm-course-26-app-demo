'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';

export const useCopyToClipboard = (duration: number = 1000) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), duration);
        toast.success('Copied email to clipboard');
      } catch (err) {
        toast.error('Failed to copy text to clipboard', {
          description:
            err instanceof Error
              ? err.message
              : 'Something went wrong please try again',
        });
      }
    },
    [duration]
  );

  return { copied, copyToClipboard };
};
