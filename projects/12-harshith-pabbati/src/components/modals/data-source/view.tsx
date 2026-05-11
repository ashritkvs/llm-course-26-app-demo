import { useViewDataSource } from '@/states/data-source';

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

import { ViewDataSourcesForm } from './forms/ViewForm';

export function ViewDataSources() {
  const isMobile = useIsMobile();
  const [id, setOpen] = useViewDataSource();

  if (isMobile) {
    return (
      <Drawer open={Boolean(id)} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>View data-sources of your organization</DrawerTitle>
            <DrawerDescription>
              Links to the docs, blogs & other help center docs
            </DrawerDescription>
          </DrawerHeader>
          <ViewDataSourcesForm orgId={id as string} />
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
          <DialogTitle>View data-sources of your organization</DialogTitle>
          <DialogDescription>
            Links to the docs, blogs & other help center docs
          </DialogDescription>
        </DialogHeader>
        <ViewDataSourcesForm orgId={id as string} />
      </DialogContent>
    </Dialog>
  );
}
