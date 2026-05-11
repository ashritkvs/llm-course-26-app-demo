'use client';

import { useCreateOrganization } from '@/states/organization';
import { PlusIcon } from '@radix-ui/react-icons';

import { Button } from '@/components/ui/button';

export function CreateOrganization() {
  const [, setCreateOrganization] = useCreateOrganization();
  return (
    <Button onClick={() => setCreateOrganization(true)} variant="link">
      <PlusIcon className="size-4" />
    </Button>
  );
}
