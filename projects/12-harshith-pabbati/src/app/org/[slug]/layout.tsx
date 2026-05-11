import { notFound, redirect } from 'next/navigation';
import { getOrganizationBySlug } from '@/actions/organization';

import { OrgLayoutClient } from '@/components/organization/OrgLayoutClient';
import { Sidebar } from '@/components/sidebar';

export default async function OrgLayout({
  params,
  children,
}: React.PropsWithChildren<{
  params: Promise<{ slug: string }>;
}>) {
  const { slug } = await params;
  const { data, error } = await getOrganizationBySlug(slug);
  if (error || !data?.id) return notFound();

  const onboarding = data.onboarding as any;
  if (!onboarding?.hasOnboarded)
    redirect(`/onboarding/${slug}/${onboarding.step}`);

  return (
    <OrgLayoutClient
      sidebar={
        <Sidebar
          orgId={data.id}
          name={data.name}
          slug={slug}
          inboundEmail={data.inbound_email ?? ''}
        />
      }
    >
      {children}
    </OrgLayoutClient>
  );
}
