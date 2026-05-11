'use client';

import { signOut } from '@/actions/auth';
import { ExitIcon, MoonIcon, SunIcon } from '@radix-ui/react-icons';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { useTheme } from 'next-themes';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Props {
  user: SupabaseUser;
}

export function User({ user }: Props) {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="neutral" className="size-9 p-0">
          <Avatar className="size-9">
            <AvatarImage src={user?.user_metadata?.avatar_url} />
            <AvatarFallback>{user?.user_metadata?.fallback}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start" forceMount>
        <DropdownMenuLabel>
          <div className="flex flex-col items-start space-y-1">
            <p className="text-sm font-medium leading-none">
              {user?.user_metadata?.full_name}
            </p>
            <p className="text-foreground font-base text-xs leading-none">
              {user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? (
            <SunIcon className="mr-2 size-4" />
          ) : (
            <MoonIcon className="mr-2 size-4" />
          )}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut()}>
          <ExitIcon className="mr-2 size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
