import { atom, useAtom } from 'jotai';

const viewOrganizationMembersState = atom<string | boolean>(false);

export const useMembers = () => useAtom(viewOrganizationMembersState);
