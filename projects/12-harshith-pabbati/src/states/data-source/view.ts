import { atom, useAtom } from 'jotai';

const viewDataSourceState = atom<string | boolean>(false);

export const useViewDataSource = () => useAtom(viewDataSourceState);
