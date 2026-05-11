import { atom, useAtom } from 'jotai';

export type AddDataSourceState = { slug: string; orgId: string } | false;

const addDataSourceState = atom<AddDataSourceState>(false);

export const useAddDataSource = () => useAtom(addDataSourceState);
