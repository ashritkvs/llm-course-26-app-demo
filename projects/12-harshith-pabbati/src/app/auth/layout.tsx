import React from 'react';

import { Header } from '@/components/header';

export default async function AuthLayout({
  children,
}: React.PropsWithChildren<{}>) {
  return (
    <div className="flex flex-col flex-1 bg-background">
      <Header />
      {children}
    </div>
  );
}
