'use client';

import { useCreateOrganization } from '@/states/organization';
import { PlusIcon } from '@radix-ui/react-icons';

import { Button } from '@/components/ui/button';

export function CreateNewOrganizationButton() {
  const [, setCreate] = useCreateOrganization();
  return (
    <Button onClick={() => setCreate(true)} className="w-full md:w-auto">
      <PlusIcon className="mr-2" />
      Create new organization
    </Button>
  );
}
