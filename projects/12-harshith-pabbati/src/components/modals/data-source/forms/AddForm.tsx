'use client';

import { useState } from 'react';
import { setupSources } from '@/actions/source';
import { sourcesQueryKey } from '@/lib/query-keys';
import { useQueryClient } from '@tanstack/react-query';
import { PlusIcon } from '@radix-ui/react-icons';
import { useFieldArray, useForm } from 'react-hook-form';

import { cn } from '@/lib/utils';
import { DataSourcesSchema, resolver } from '@/lib/zod/data-source';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

interface Props {
  slug: string;
  onAdd?(): void;
  /** org ID – used to invalidate the TanStack Query sources cache */
  orgId?: string;
}

export function AddDataSourceForm({ slug, onAdd, orgId }: Props) {
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const form = useForm<DataSourcesSchema>({
    resolver,
    defaultValues: {
      urls: [{ url: '' }],
    },
    mode: 'onChange',
  });
  const { fields, append } = useFieldArray({
    name: 'urls',
    control: form.control,
  });

  const handleSubmit = async ({ urls }: DataSourcesSchema) => {
    const { error } = await setupSources(slug as string, urls);
    if (error) {
      console.error(error);
      setError(error.message);
      return;
    }
    if (orgId) {
      await queryClient.invalidateQueries({ queryKey: sourcesQueryKey(orgId) });
    }
    onAdd?.();
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
          {fields.map((field, index) => (
            <FormField
              control={form.control}
              key={field.id}
              name={`urls.${index}.url`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={cn(index !== 0 && 'sr-only')}>
                    URLs
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/docs" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
          <Button
            type="button"
            variant="neutral"
            size="sm"
            className="mt-2"
            onClick={() => append({ url: '' })}
          >
            <PlusIcon className="mr-2" />
            Add URL
          </Button>
        </div>
        <Button
          disabled={form.formState.isSubmitting || !form.formState.isValid}
          className="w-full"
        >
          {form.formState.isSubmitting ? 'Saving...' : 'Save'}
        </Button>
      </form>
    </Form>
  );
}
