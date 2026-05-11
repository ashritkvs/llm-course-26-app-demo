import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getOrganizationBySlug } from '@/actions/organization';
import { getAdminSources, getRecentReplies } from '@/actions/source';

import { AdminPage } from '@/components/organization/admin/AdminPage';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Admin – ${slug}` };
}

export default async function AdminRoutePage({ params }: Props) {
  const { slug } = await params;
  const { data: org } = await getOrganizationBySlug(slug);
  if (!org?.id) return notFound();

  const [sources, replies] = await Promise.all([
    getAdminSources(org.id),
    getRecentReplies(org.id),
  ]);

  return (
    <AdminPage
      orgId={org.id}
      slug={slug}
      initialSources={sources}
      initialReplies={replies}
    />
  );
}
