import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getOrganizationBySlug } from '@/actions/organization';
import { getWorkflows } from '@/actions/workflow';

import { WorkflowsPage } from '@/components/organization/workflows/WorkflowsPage';
import type { Workflow, WorkflowStep, WorkflowTrigger } from '@/lib/workflow-types';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Workflows – ${slug}` };
}

export default async function WorkflowsRoutePage({ params }: Props) {
  const { slug } = await params;
  const { data: org } = await getOrganizationBySlug(slug);
  if (!org?.id) return notFound();

  const { data } = await getWorkflows(org.id);
  const workflows: Workflow[] = (data ?? []).map((w) => ({
    ...w,
    trigger: w.trigger as unknown as WorkflowTrigger,
    steps: (w.steps as unknown as WorkflowStep[]) ?? [],
  }));

  return <WorkflowsPage orgId={org.id} slug={slug} initialWorkflows={workflows} />;
}
