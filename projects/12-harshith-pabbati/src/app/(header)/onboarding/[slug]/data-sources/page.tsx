import { Metadata } from 'next';

import { DataSources } from '@/components/onboarding';

export const metadata: Metadata = {
  title: 'Setup datasources - Onboarding',
};

export default async function DataSourcesOnboardingPage() {
  return <DataSources />;
}
