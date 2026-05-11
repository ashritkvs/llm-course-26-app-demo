/** Centralised TanStack Query key factory */
export const sourcesQueryKey = (orgId: string) => ['sources', orgId] as const;
export const mcpServersQueryKey = (orgId: string) =>
  ['mcp-servers', orgId] as const;
export const workflowsQueryKey = (orgId: string) =>
  ['workflows', orgId] as const;
