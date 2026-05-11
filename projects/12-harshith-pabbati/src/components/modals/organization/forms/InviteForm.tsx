import { useState } from 'react';
import { inviteMember } from '@/actions/organization';
import { useForm } from 'react-hook-form';

import { InviteMemberSchema, resolver } from '@/lib/zod/invite-member';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  orgId: string;
  onInvite?(): void;
}

export function InviteMemberForm({ orgId, onInvite }: Props) {
  const [error, setError] = useState('');

  const form = useForm<InviteMemberSchema>({
    resolver,
    defaultValues: {
      email: '',
      role: '0',
    },
    mode: 'onChange',
  });

  const handleSubmit = async (invite: InviteMemberSchema) => {
    const { error } = await inviteMember(orgId, invite);
    if (error) {
      console.error(error);
      setError(error.message);
      return;
    }
    onInvite?.();
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
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="user@acme.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="0">Member</SelectItem>
                    <SelectItem value="1">Admin</SelectItem>
                    <SelectItem value="2">Owner</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button
          disabled={form.formState.isSubmitting || !form.formState.isValid}
          className="w-full"
        >
          {form.formState.isSubmitting ? 'Inviting...' : 'Invite user'}
        </Button>
      </form>
    </Form>
  );
}
