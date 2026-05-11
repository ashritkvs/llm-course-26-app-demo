'use client';

import { useCallback, useState } from 'react';
import {
  addMcpServer,
  deleteMcpServer,
  fetchMcpServers,
} from '@/actions/mcp-server';
import { Tables } from '@/database.types';
import { useManageMcpServers } from '@/states/mcp-server';
import { TrashIcon } from '@radix-ui/react-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { mcpServersQueryKey } from '@/lib/query-keys';
import { useIsMobile } from '@/hooks/useIsMobile';
import { Button } from '@/components/ui/button';
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

function McpServerContent({
  orgId,
  slug,
}: {
  orgId: string;
  slug: string;
}) {
  const queryClient = useQueryClient();
  const { data: servers = [], isLoading } = useQuery<Tables<'mcp_server'>[]>({
    queryKey: mcpServersQueryKey(orgId),
    queryFn: () => fetchMcpServers(orgId),
    enabled: Boolean(orgId),
  });

  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [description, setDescription] = useState('');

  const handleAdd = async () => {
    if (!name.trim() || !url.trim()) return;
    setSaving(true);
    const { error } = await addMcpServer(
      orgId,
      {
        name: name.trim(),
        url: url.trim(),
        api_key: apiKey.trim() || undefined,
        description: description.trim() || undefined,
      },
      slug
    );
    setSaving(false);
    if (error) {
      toast.error('Failed to add MCP server', {
        description: error.message,
      });
      return;
    }
    setName('');
    setUrl('');
    setApiKey('');
    setDescription('');
    toast.success('MCP server added');
    await queryClient.invalidateQueries({
      queryKey: mcpServersQueryKey(orgId),
    });
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteMcpServer(id, slug);
    if (error) {
      toast.error('Failed to remove MCP server', {
        description: error.message,
      });
      return;
    }
    toast.success('MCP server removed');
    await queryClient.invalidateQueries({
      queryKey: mcpServersQueryKey(orgId),
    });
  };

  const inputClass =
    'w-full border border-input bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FF4500]';

  return (
    <div className="space-y-6 p-4">
      {/* Existing MCP servers */}
      {isLoading ? (
        <p className="font-mono text-sm text-muted-foreground">Loading…</p>
      ) : servers.length === 0 ? (
        <p className="font-mono text-sm text-muted-foreground">
          No MCP servers yet. Add one below.
        </p>
      ) : (
        <ul className="space-y-2">
          {servers.map((server) => (
            <li
              key={server.id}
              className="flex items-start justify-between gap-3 border border-[#FF4500]/20 bg-muted px-3 py-2"
            >
              <div className="min-w-0">
                <p className="font-mono text-sm font-semibold text-foreground">
                  {server.name}
                </p>
                <p className="font-mono text-xs text-muted-foreground truncate">
                  {server.url}
                </p>
                {server.description && (
                  <p className="font-mono text-xs text-gray-500 mt-0.5">
                    {server.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete(server.id)}
                className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                aria-label={`Remove ${server.name}`}
              >
                <TrashIcon className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add new MCP server form */}
      <div className="space-y-3 border-t border-border pt-4">
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#FF4500]">
          {'// Add new MCP server'}
        </p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (e.g. My CRM, Stripe MCP)"
          className={inputClass}
        />
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="MCP Server URL (e.g. https://mcp.example.com/sse)"
          className={inputClass}
        />
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="API Key / Bearer Token (optional)"
          className={inputClass}
        />
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description — what tools does this MCP server expose? (e.g. Customer orders and billing data)"
          className={`${inputClass} resize-y`}
        />
        <Button
          onClick={handleAdd}
          disabled={saving || !name.trim() || !url.trim()}
          className="w-full"
        >
          {saving ? 'Adding…' : 'Add MCP Server'}
        </Button>
      </div>
    </div>
  );
}

export function ManageMcpServers() {
  const isMobile = useIsMobile();
  const [state, setState] = useManageMcpServers();

  const orgId = state ? state.orgId : '';
  const slug = state ? state.slug : '';

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) setState(false);
    },
    [setState]
  );

  if (isMobile) {
    return (
      <Drawer open={Boolean(state)} onOpenChange={handleOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>🔌 MCP Servers</DrawerTitle>
            <DrawerDescription>
              Connect MCP servers so Answerify can call their tools to fetch
              live customer data when generating replies.
            </DrawerDescription>
          </DrawerHeader>
          <McpServerContent orgId={orgId} slug={slug} />
          <DrawerFooter>
            <DrawerClose />
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={Boolean(state)} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>🔌 MCP Servers</DialogTitle>
          <DialogDescription>
            Connect MCP servers so Answerify can call their tools to fetch live
            customer data when generating replies.
          </DialogDescription>
        </DialogHeader>
        <McpServerContent orgId={orgId} slug={slug} />
      </DialogContent>
    </Dialog>
  );
}
