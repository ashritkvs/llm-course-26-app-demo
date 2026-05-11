import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getEmails, getThread } from '@/actions/email';
import { getReply } from '@/actions/reply';

import {
  ConversationHeader,
  Conversations,
} from '@/components/organization/conversation';

type ThreadStatus = 'open' | 'closed';

interface Props {
  params: Promise<{ id: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { data, error } = await getThread(id);
  return {
    title: error ? 'Not found' : data?.subject,
  };
}

export default async function EmailPage({ params }: Props) {
  const { id, slug } = await params;
  const [{ data: thread, error: threadError }, { data }, { data: replyData }] =
    await Promise.all([getThread(id), getEmails(id), getReply(id)]);

  if (threadError || !thread?.id) return notFound();

  return (
    <div className="max-h-dvh overflow-hidden">
      <ConversationHeader {...thread} slug={slug} />
      <Conversations
        threadId={thread.id}
        conversations={data ?? []}
        reply={replyData ?? null}
        status={thread.status as ThreadStatus}
      />
    </div>
  );
}
