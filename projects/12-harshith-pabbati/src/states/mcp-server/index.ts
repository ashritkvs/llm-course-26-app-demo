import { atom, useAtom } from 'jotai';

export type ManageMcpServersState = { orgId: string; slug: string } | false;

const manageMcpServersState = atom<ManageMcpServersState>(false);

export const useManageMcpServers = () => useAtom(manageMcpServersState);
