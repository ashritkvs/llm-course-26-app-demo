import { atom, useAtom } from 'jotai';

const inviteOrganizationMembersState = atom<string | boolean>(false);

export const useInviteMembers = () => useAtom(inviteOrganizationMembersState);
