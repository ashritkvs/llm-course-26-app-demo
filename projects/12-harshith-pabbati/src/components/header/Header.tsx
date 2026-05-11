import React from 'react';
import { getUser } from '@/actions/auth';
import { Link } from 'next-view-transitions';

import { buttonVariants } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';

import { User } from '../sidebar';

interface Props {
  isDashboard?: boolean;
}

export async function Header({ isDashboard = true }: Props) {
  const {
    data: { user },
  } = await getUser();

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-[#FF4500] bg-background px-4 md:px-6">
      <Link href="/">
        <h1 className="font-mono text-base font-bold uppercase tracking-[0.2em] text-foreground">
          <span className="text-[#FF4500]">ANSWER</span>IFY
        </h1>
      </Link>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        {user?.id ? (
          <>
            {isDashboard ? (
              <User user={user} />
            ) : (
              <Link href="/dashboard" className={buttonVariants()}>
                Go to dashboard
              </Link>
            )}
          </>
        ) : (
          <div className="flex gap-2">
            <Link href="/auth/sign-in" className={buttonVariants()}>
              Sign in
            </Link>
            <Link
              href="/auth/sign-up"
              className={buttonVariants({ variant: 'shadow' })}
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
