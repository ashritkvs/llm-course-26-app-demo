import { atom, useAtom } from 'jotai';

const createOrganizationModalState = atom<boolean>(false);

export const useCreateOrganization = () =>
  useAtom(createOrganizationModalState);
