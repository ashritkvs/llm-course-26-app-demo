import { useCallback } from 'react';
import { useInviteMembers } from '@/states/organization';
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

import { InviteMemberForm } from './forms';

export function InviteMembers() {
  const isMobile = useIsMobile();
  const [id, setOpen] = useInviteMembers();

  const handleInviteUsers = useCallback(() => {
    setOpen(false);
    toast.success('Success', {
      description: 'Invited user to your organization!',
    });
  }, [setOpen]);

  if (isMobile) {
    return (
      <Drawer open={Boolean(id)} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Invite members to your organization</DrawerTitle>
            <DrawerDescription>
              You can invite users to your organization
            </DrawerDescription>
          </DrawerHeader>
          <InviteMemberForm orgId={id as string} onInvite={handleInviteUsers} />
        </DrawerContent>
        <DrawerFooter>
          <DrawerClose />
        </DrawerFooter>
      </Drawer>
    );
  }

  return (
    <Dialog open={Boolean(id)} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite members to your organization</DialogTitle>
          <DialogDescription>
            You can invite users to your organization
          </DialogDescription>
        </DialogHeader>
        <InviteMemberForm orgId={id as string} onInvite={handleInviteUsers} />
      </DialogContent>
    </Dialog>
  );
}
