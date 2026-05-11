import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMcpServers } from '@/actions/mcp-server';
import { getOrgStats } from '@/actions/email';
import { getOrganizationBySlug } from '@/actions/organization';
import { getSources } from '@/actions/source';
import { getWorkflows } from '@/actions/workflow';

import {
  AUTOPILOT_ENABLED_DEFAULT,
  AUTOPILOT_THRESHOLD_DEFAULT,
} from '@/lib/autopilot';
import { WelcomeDashboard } from '@/components/organization/WelcomeDashboard';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { data, error } = await getOrganizationBySlug(slug);
  return {
    title: error ? 'Not found' : data?.name,
  };
}

export default async function OrgPage({ params }: Props) {
  const { slug } = await params;
  const { data: org } = await getOrganizationBySlug(slug);
  if (!org?.id) return notFound();

  const [
    { data: sources },
    { threadCount, replyCount },
    { data: mcpServers },
    { data: workflows },
  ] = await Promise.all([
    getSources(org.id),
    getOrgStats(org.id),
    getMcpServers(org.id),
    getWorkflows(org.id),
  ]);

  return (
    <WelcomeDashboard
      orgId={org.id}
      orgName={org.name}
      slug={slug}
      inboundEmail={org.inbound_email ?? ''}
      supportEmail={org.support_email ?? ''}
      sources={sources ?? []}
      threadsCount={threadCount}
      repliesCount={replyCount}
      autopilotEnabled={org.autopilot_enabled ?? AUTOPILOT_ENABLED_DEFAULT}
      autopilotThreshold={
        org.autopilot_threshold ?? AUTOPILOT_THRESHOLD_DEFAULT
      }
      initialTonePolicy={org.tone_policy ?? null}
      initialMcpServers={mcpServers ?? []}
      workflowsCount={workflows?.length ?? 0}
    />
  );
}
