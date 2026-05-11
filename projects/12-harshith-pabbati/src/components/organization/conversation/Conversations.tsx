'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { sendEmail } from '@/actions/email';
import { Tables } from '@/database.types';

import { useTiptap } from '@/hooks/useTiptap';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { Conversation } from './Conversation';

// Dynamically import Tiptap to reduce initial bundle size
const Tiptap = dynamic(
  () =>
    import('@/components/ui/tiptap').then((mod) => ({ default: mod.Tiptap })),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg mt-4 h-40 animate-pulse bg-gradient-to-r from-muted via-muted/50 to-muted" />
    ),
  }
);

type ThreadStatus = 'open' | 'closed';

interface Props {
  threadId: string;
  conversations: Tables<'email'>[];
  reply: Tables<'reply'> | null;
  status: ThreadStatus;
}

function confidenceLabel(score: number): string {
  if (score >= 0.85) return 'High';
  if (score >= 0.65) return 'Medium';
  if (score > 0) return 'Low';
  return 'None';
}

function confidenceVariant(score: number): 'default' | 'neutral' {
  if (score >= 0.65) return 'default';
  return 'neutral';
}

export function Conversations({
  threadId,
  conversations,
  reply,
  status,
}: Props) {
  const router = useRouter();
  const divRef = useRef<HTMLDivElement>(null);

  const lastEmail = conversations[conversations.length - 1];
  const editor = useTiptap(
    lastEmail?.role === 'user' ? (reply?.content ?? '') : ''
  );

  useEffect(() => {
    if (!divRef.current) return;
    divRef.current.scrollTop = divRef.current.scrollHeight;
  }, [conversations]);

  const handleSubmit = async (
    ticketStatus: ThreadStatus | undefined = undefined
  ) => {
    if (!editor || !reply?.id) return;
    const content = editor.getHTML();
    await fetch(`/api/replies/${reply.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    await sendEmail(threadId, {
      content,
      replyId: reply.id,
      status: ticketStatus,
    });
    editor.commands.setContent('');
    router.refresh();
  };

  const confidenceScore = reply?.confidence_score ?? 0;

  return (
    <div className="flex h-[calc(100dvh-60px-4rem)] flex-col items-start justify-between md:h-[calc(100dvh-60px)]">
      <div
        ref={divRef}
        className="flex size-full flex-col gap-6 overflow-scroll p-4 md:p-6"
      >
        {conversations.map((c) => (
          <Conversation key={c.id} {...c} />
        ))}
      </div>

      <div className="relative w-full border-t border-[#FF4500]/10 bg-gradient-to-t from-muted/30 to-background p-4 backdrop-blur-sm">
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-[#FF4500]/20 to-transparent" />

        {reply && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider">
              AI confidence:
            </span>
            <Badge
              variant={confidenceVariant(confidenceScore)}
              className="text-xs font-semibold"
            >
              {confidenceLabel(confidenceScore)}{' '}
              {confidenceScore > 0
                ? `(${Math.round(confidenceScore * 100)}%)`
                : ''}
            </Badge>
            {reply.status === 'sent' && (
              <Badge
                variant="default"
                className="text-xs font-semibold animate-pulse"
              >
                Auto-sent
              </Badge>
            )}
          </div>
        )}

        <Tiptap editor={editor} />

        <div className="mt-3 flex flex-col md:flex-row justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => handleSubmit()}
            size="lg"
            className="border-[#FF4500]/30 hover:bg-[#FF4500]/10 hover:border-[#FF4500]"
          >
            Submit
          </Button>
          <Button
            onClick={() =>
              handleSubmit(status === 'closed' ? 'open' : 'closed')
            }
            size="lg"
            className="bg-gradient-to-r from-[#FF4500] to-[#FF6B35] hover:from-[#FF4500]/90 hover:to-[#FF6B35]/90 shadow-lg shadow-[#FF4500]/20"
          >
            {status === 'closed' ? 'Submit & re-open' : 'Submit & close'}
          </Button>
        </div>
      </div>
    </div>
  );
}
