import { atom, useAtom } from 'jotai';

const testSandboxModalState = atom<boolean | string>(false);

export const useTestSandbox = () => useAtom(testSandboxModalState);
