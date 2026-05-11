import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { ViewTransitions } from 'next-view-transitions';

import { siteConfig } from '@/lib/config';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/sonner';
import { Modals } from '@/components/modals';
import { Providers } from '@/components/providers';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ViewTransitions>
      <html lang="en" suppressHydrationWarning>
        <body
          className={cn(
            'bg-background flex max-h-dvh min-h-dvh flex-col',
            GeistSans.className,
            GeistMono.variable
          )}
        >
          <Providers>
            {children}
            <Modals />
            <Toaster />
          </Providers>
        </body>
      </html>
    </ViewTransitions>
  );
}
