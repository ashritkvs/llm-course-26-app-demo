import { Metadata } from 'next';

import { siteConfig } from '@/lib/config';
import { Header } from '@/components/header';
import { Features, Hero, Slider, TickerBar } from '@/components/marketing';

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
};

export default function Home() {
  return (
    <div className="size-full flex-1 bg-background text-foreground">
      <TickerBar />
      <Header isDashboard={false} />
      <Hero />
      <Features />
      <Slider />
    </div>
  );
}
