import { useState } from 'react';
import { createOrganization } from '@/actions/organization';
import { useForm } from 'react-hook-form';

import { slugify } from '@/lib/slug';
import { OrganizationSchema, resolver } from '@/lib/zod/organization';
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

interface Props {
  onCreate?(slug: string): void;
}

export function CreateOrganizationForm({ onCreate }: Props) {
  const [error, setError] = useState('');

  const form = useForm<OrganizationSchema>({
    resolver,
    defaultValues: {
      name: '',
      support_email: '',
    },
    mode: 'onChange',
  });

  const handleSubmit = async (org: OrganizationSchema) => {
    const { data, error } = await createOrganization(org);
    if (error) {
      console.error(error);
      setError(error.message);
      return;
    }
    onCreate?.(data.slug);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="w-full space-y-6"
      >
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error ?? 'Something went wrong, please try again'}
            </AlertDescription>
          </Alert>
        )}
        <div className="space-y-3">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Acme, Inc" {...field} />
                </FormControl>
                <FormDescription>
                  This will be the name of your organization.
                </FormDescription>
                {field.value && (
                  <FormDescription>
                    Your URL will be{' '}
                    {`${window.location.origin}/org/${slugify(field.value)}`}
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="support_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Support Email</FormLabel>
                <FormControl>
                  <Input placeholder="support@acme.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button
          disabled={form.formState.isSubmitting || !form.formState.isValid}
          className="w-full"
        >
          {form.formState.isSubmitting ? 'Creating...' : 'Create organization'}
        </Button>
      </form>
    </Form>
  );
}
