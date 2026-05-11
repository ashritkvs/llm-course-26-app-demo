'use client';

import React, { useState } from 'react';
import { useTransitionRouter } from 'next-view-transitions';
import { signUpWithPassword } from '@/actions/auth';
import { CheckIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { useForm } from 'react-hook-form';

import { cn } from '@/lib/utils';
import { defaultValues, resolver, SignUpSchema } from '@/lib/zod/sign-up';
import { usePasswordStrength } from '@/hooks/usePasswordStrength';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';

export function SignUp() {
  const router = useTransitionRouter();
  const [verifyEmail, setVerifyEmail] = useState(false);
  const [error, setError] = useState('');

  const form = useForm<SignUpSchema>({
    resolver,
    defaultValues,
    mode: 'onChange',
  });

  // eslint-disable-next-line
  const password = form.watch('password');

  const { strength, feedback } = usePasswordStrength(password);

  const handleSubmit = async (creds: SignUpSchema) => {
    const { data, error } = await signUpWithPassword(creds);
    if (error || !data?.user) {
      setError(error?.message ?? '');
      return;
    }

    if (data?.session) {
      router.push('/dashboard');
      return;
    } else if (data?.user?.role === 'authenticated') {
      setVerifyEmail(true);
      return;
    } else {
      setError(
        'Account already exists for this user, please proceed to sign-in'
      );
    }
  };

  return (
    <Form {...form}>
      {verifyEmail ? (
        <Alert>
          <CheckIcon className="size-4" />
          <AlertTitle>Verify your email</AlertTitle>
          <AlertDescription>
            We have sent you an email. Please check your inbox and click on the
            link to verify your email.
          </AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <div className="space-y-3">
            {error && (
              <Alert variant="destructive">
                <ExclamationTriangleIcon className="size-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {error || 'Something went wrong. Please try again.'}
                </AlertDescription>
              </Alert>
            )}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your name here" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email address</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your email here" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex justify-between">
                    <FormLabel>Password</FormLabel>
                    {password && (
                      <p className={cn('text-xs font-medium', strength.color)}>
                        {strength.label}
                      </p>
                    )}
                  </div>
                  <FormControl>
                    <PasswordInput
                      placeholder="Enter your password here"
                      {...field}
                    />
                  </FormControl>
                  {feedback.warning && (
                    <FormDescription className="text-destructive font-medium">
                      {feedback.warning}
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button
            disabled={form.formState.isSubmitting || !form.formState.isValid}
            className="w-full"
            type="submit"
          >
            {form.formState.isSubmitting ? 'Signing up...' : 'Sign up'}
          </Button>
        </form>
      )}
    </Form>
  );
}
