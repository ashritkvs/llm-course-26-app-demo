'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAddDataSource } from '@/states/data-source';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
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

import { AddDataSourceForm, DomainImportForm } from './forms';

type Tab = 'manual' | 'domain';

function TabBar({ active, onChange }: { active: Tab; onChange(t: Tab): void }) {
  return (
    <div className="flex gap-1 rounded border p-1 text-sm">
      {(['manual', 'domain'] as Tab[]).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={cn(
            'flex-1 rounded px-3 py-1 transition-colors',
            active === t
              ? 'bg-foreground text-background font-medium'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {t === 'manual' ? 'Add URLs' : 'Import from domain'}
        </button>
      ))}
    </div>
  );
}

function DataSourceContent({
  slug,
  orgId,
  onAdd,
}: {
  slug: string;
  orgId: string;
  onAdd(): void;
}) {
  const [tab, setTab] = useState<Tab>('manual');

  return (
    <div className="space-y-4 overflow-auto">
      <TabBar active={tab} onChange={setTab} />
      {tab === 'manual' ? (
        <AddDataSourceForm slug={slug} orgId={orgId} onAdd={onAdd} />
      ) : (
        <DomainImportForm slug={slug} orgId={orgId} onAdd={onAdd} />
      )}
    </div>
  );
}

export function AddDataSource() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const [state, setOpen] = useAddDataSource();

  const slug = state ? state.slug : '';
  const orgId = state ? state.orgId : '';

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) setOpen(false);
    },
    [setOpen]
  );

  const handleOnAdd = useCallback(() => {
    setOpen(false);
    router.refresh();
    toast.success('Successfully added new data-sources', {
      description: 'Processing the new sources',
    });
  }, [setOpen, router]);

  if (isMobile) {
    return (
      <Drawer open={Boolean(state)} onOpenChange={handleOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Add data-source to your organization</DrawerTitle>
            <DrawerDescription>
              Add your links to the docs, blogs & other help center docs
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4">
            <DataSourceContent
              slug={slug}
              orgId={orgId}
              onAdd={handleOnAdd}
            />
          </div>
        </DrawerContent>
        <DrawerFooter>
          <DrawerClose />
        </DrawerFooter>
      </Drawer>
    );
  }

  return (
    <Dialog open={Boolean(state)} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add data-source to your organization</DialogTitle>
          <DialogDescription>
            Add your links to the docs, blogs & other help center docs
          </DialogDescription>
        </DialogHeader>
        <DataSourceContent slug={slug} orgId={orgId} onAdd={handleOnAdd} />
      </DialogContent>
    </Dialog>
  );
}
