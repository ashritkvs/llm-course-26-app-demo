'use client';

import { createBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

export function SocialLogins() {
  const supabase = createBrowserClient();
  const handleSocialLogin = async (social: 'google') => {
    await supabase.auth.signInWithOAuth({
      provider: social,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <Button
        onClick={() => handleSocialLogin('google')}
        className="w-full"
        size="lg"
      >
        Continue with Google
      </Button>
    </div>
  );
}
