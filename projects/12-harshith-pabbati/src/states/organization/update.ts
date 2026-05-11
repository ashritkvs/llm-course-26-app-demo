import { atom, useAtom } from 'jotai';

export type UpdateOrganizationState = {
  id: string;
  name: string;
  support_email: string;
} | false;

const updateOrganizationModalState = atom<UpdateOrganizationState>(false);

export const useUpdateOrganization = () =>
  useAtom(updateOrganizationModalState);
