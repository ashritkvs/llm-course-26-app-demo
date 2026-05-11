'use client';

import { useParams } from 'next/navigation';
import { useTransitionRouter } from 'next-view-transitions';
import { deleteOrganization } from '@/actions/organization';
import { Tables } from '@/database.types';
import { useAddDataSource, useViewDataSource } from '@/states/data-source';
import {
  useInviteMembers,
  useMembers,
  useUpdateOrganization,
} from '@/states/organization';
import {
  FileIcon,
  FilePlusIcon,
  Pencil1Icon,
  PersonIcon,
  TrashIcon,
} from '@radix-ui/react-icons';
import { toast } from 'sonner';

import { getNameInitials } from '@/lib/gravatar';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

export function Organization({ id, name, slug, support_email }: Tables<'organization'>) {
  const router = useTransitionRouter();
  const params = useParams();
  const [, setUpdateOrganization] = useUpdateOrganization();
  const [, setAddDataSource] = useAddDataSource();
  const [, setViewDataSource] = useViewDataSource();
  const [, inviteMember] = useInviteMembers();
  const [, setViewMembers] = useMembers();

  const handleDelete = async () => {
    const { error } = await deleteOrganization(id);
    if (error) {
      toast.error('Organization Deletion Failed', {
        description:
          'We are unable to delete the organization at this time. Please try again later',
      });
    }
    toast.success('Successfully deleted your organization', {
      description: 'Please wait while we redirect you to dashboard',
    });
    router.push('/dashboard');
    router.refresh();
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Button
          variant={params.slug === slug ? 'default' : 'neutral'}
          className="size-10"
          onClick={() => router.push(`/org/${slug}`)}
        >
          {getNameInitials(name)}
        </Button>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52" forceMount>
        <ContextMenuLabel>
          <div className="flex flex-col items-start space-y-1">
            <p className="text-sm font-medium leading-none">{name}</p>
            <p className="text-foreground text-xs leading-none">{slug}</p>
          </div>
        </ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => setUpdateOrganization({ id, name, support_email })}>
          Edit
          <ContextMenuShortcut>
            <Pencil1Icon />
          </ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>Members</ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-56">
            <ContextMenuItem onSelect={() => setViewMembers(id)}>
              View
              <ContextMenuShortcut>
                <PersonIcon />
              </ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => inviteMember(id)}>
              Invite members
              <ContextMenuShortcut>
                <PersonIcon />
              </ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger>Data sources</ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-56">
            <ContextMenuItem onSelect={() => setViewDataSource(id)}>
              View sources
              <ContextMenuShortcut>
                <FileIcon />
              </ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => setAddDataSource({ slug, orgId: id })}>
              Add new sources
              <ContextMenuShortcut>
                <FilePlusIcon />
              </ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem className="text-destructive" onSelect={handleDelete}>
          Delete
          <ContextMenuShortcut>
            <TrashIcon />
          </ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
