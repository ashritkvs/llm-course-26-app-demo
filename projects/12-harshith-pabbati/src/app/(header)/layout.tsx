import React from 'react';

import { Header } from '@/components/header';

export default function HeaderLayout({
  children,
}: React.PropsWithChildren<{}>) {
  return (
    <div className="flex size-full h-dvh flex-col bg-background">
      <Header />
      <div className="size-full flex-1 bg-background">{children}</div>
    </div>
  );
}
