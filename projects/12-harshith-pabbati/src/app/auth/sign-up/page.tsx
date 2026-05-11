import { Metadata } from 'next';
import { Link } from 'next-view-transitions';

import { siteConfig } from '@/lib/config';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SignUp, SocialLogins } from '@/components/auth';

export const metadata: Metadata = {
  title: 'Sign up',
};

export default function SignUpPage() {
  return (
    <div className="relative z-10 flex flex-1 items-center justify-center bg-background">
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            'linear-gradient(to right, #FF4500 1px, transparent 1px), linear-gradient(to bottom, #FF4500 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
      <Card className="w-[25rem] max-w-[calc(100vw-5vw)]">
        <CardHeader>
          <CardTitle>Sign up</CardTitle>
          <CardDescription>to continue to {siteConfig.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <SocialLogins />
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[#FF4500]/20" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background font-mono px-2 text-muted-foreground tracking-widest">Or</span>
            </div>
          </div>
          <SignUp />
        </CardContent>
        <CardFooter className="flex gap-1 text-sm">
          <p className="font-mono text-gray-400">Already have an account?</p>
          <Link className="font-mono text-[#FF4500] underline" href="/auth/sign-in">
            Sign in
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
