import { useCallback } from 'react';
import { useTransitionRouter } from 'next-view-transitions';
import { useCreateOrganization } from '@/states/organization';
import { toast } from 'sonner';

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

import { CreateOrganizationForm } from './forms';

export function CreateOrganization() {
  const isMobile = useIsMobile();
  const router = useTransitionRouter();
  const [open, setOpen] = useCreateOrganization();

  const handleOnCreate = useCallback(
    (name: string) => {
      setOpen(false);
      toast.success('Successfully created your organization', {
        description: 'Please wait while we redirect you!',
      });
      router.push(`/onboarding/${name}/email-forwarding`);
      router.refresh();
    },
    [router, setOpen]
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Set up your organization</DrawerTitle>
            <DrawerDescription>
              Tell us about your organization
            </DrawerDescription>
          </DrawerHeader>
          <CreateOrganizationForm onCreate={handleOnCreate} />
        </DrawerContent>
        <DrawerFooter>
          <DrawerClose />
        </DrawerFooter>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set up your organization</DialogTitle>
          <DialogDescription>Tell us about your organization</DialogDescription>
        </DialogHeader>
        <CreateOrganizationForm onCreate={handleOnCreate} />
      </DialogContent>
    </Dialog>
  );
}
