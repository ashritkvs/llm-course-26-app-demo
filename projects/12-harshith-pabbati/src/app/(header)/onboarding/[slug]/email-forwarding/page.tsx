import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getOrganizationEmail } from '@/actions/organization';

import { EmailForwarding } from '@/components/onboarding';

export const metadata: Metadata = {
  title: 'Email Forwarding - Onboarding',
};

export default async function EmailForwardingOnboardingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data, error } = await getOrganizationEmail(slug);
  if (error || !data?.inbound_email) return notFound();

  return <EmailForwarding slug={slug} email={data.inbound_email} />;
}
