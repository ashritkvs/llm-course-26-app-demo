import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommonPackage from '@zxcvbn-ts/language-common';
import * as zxcvbnEnPackage from '@zxcvbn-ts/language-en';

const PASSWORD_STRENGTHS = [
  { label: 'Very weak', color: 'text-destructive' },
  { label: 'Weak', color: 'text-destructive' },
  { label: 'Medium', color: 'text-orange-500' },
  { label: 'Strong', color: 'text-green-500' },
  { label: 'Very Strong', color: 'text-green-500' },
];

export const usePasswordStrength = (password: string) => {
  const options = {
    dictionary: {
      ...zxcvbnCommonPackage.dictionary,
      ...zxcvbnEnPackage.dictionary,
    },
    graphs: zxcvbnCommonPackage.adjacencyGraphs,
    translations: zxcvbnEnPackage.translations,
  };
  zxcvbnOptions.setOptions(options);

  const { score, ...rest } = zxcvbn(password);
  return {
    strength: PASSWORD_STRENGTHS[score],
    ...rest,
  };
};
