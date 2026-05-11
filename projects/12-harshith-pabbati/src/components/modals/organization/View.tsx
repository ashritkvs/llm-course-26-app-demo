import { useMembers } from '@/states/organization';

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

export function ViewMembers() {
  const isMobile = useIsMobile();
  const [id, setOpen] = useMembers();

  if (isMobile) {
    return (
      <Drawer open={Boolean(id)} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>View members of your organization</DrawerTitle>
            <DrawerDescription>
              You can view members of your organization
            </DrawerDescription>
          </DrawerHeader>
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
          <DialogTitle>View members of your organization</DialogTitle>
          <DialogDescription>
            You can view members of your organization
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
