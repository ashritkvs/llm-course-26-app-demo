import { useCallback } from 'react';
import { useUpdateOrganization } from '@/states/organization';

import { useIsMobile } from '@/hooks/useIsMobile';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

import { UpdateOrganizationForm } from './forms/UpdateForm';

export function UpdateOrganization() {
  const isMobile = useIsMobile();
  const [org, setOrg] = useUpdateOrganization();

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) setOrg(false);
    },
    [setOrg]
  );

  if (isMobile) {
    return (
      <Drawer open={Boolean(org)} onOpenChange={handleOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Update your organization</DrawerTitle>
            <DrawerDescription>
              Update the details of your organization
            </DrawerDescription>
          </DrawerHeader>
          <UpdateOrganizationForm />
        </DrawerContent>
        <DrawerFooter>
          <DrawerClose />
        </DrawerFooter>
      </Drawer>
    );
  }

  return (
    <Dialog open={Boolean(org)} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update your organization</DialogTitle>
          <DialogDescription>
            Update the details of your organization
          </DialogDescription>
        </DialogHeader>
        <UpdateOrganizationForm />
      </DialogContent>
    </Dialog>
  );
}
