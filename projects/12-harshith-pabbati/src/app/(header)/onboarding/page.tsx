import { Metadata } from 'next';

import { Organization } from '@/components/onboarding';

export const metadata: Metadata = {
  title: 'Onboarding',
};

export default async function OnboardingPage() {
  return <Organization />;
}
