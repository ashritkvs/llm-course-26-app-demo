import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getOrganizationBySlug } from '@/actions/organization';

import { SandboxPage } from '@/components/organization/sandbox/SandboxPage';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Sandbox – ${slug}` };
}

export default async function SandboxRoutePage({ params }: Props) {
  const { slug } = await params;
  const { data: org } = await getOrganizationBySlug(slug);
  if (!org?.id) return notFound();

  return <SandboxPage orgId={org.id} slug={slug} />;
}
