import React from 'react';
import { getUser } from '@/actions/auth';

import { JotaiProvider } from '@/components/providers/JotaiProvider';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

export async function Providers({ children }: React.PropsWithChildren<{}>) {
  const {
    data: { user },
  } = await getUser();
  return (
    <ThemeProvider>
      <QueryProvider>
        <JotaiProvider>{children}</JotaiProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
