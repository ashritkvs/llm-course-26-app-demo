'use client';

import React from 'react';
import { Provider } from 'jotai';

export function JotaiProvider({ children }: React.PropsWithChildren<{}>) {
  return <Provider>{children}</Provider>;
}
