import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

export default tseslint
  .config(
    { ignores: ['dist'] },
    {
      extends: [js.configs.recommended, ...tseslint.configs.recommended],
      files: ['**/*.{ts,tsx}'],
      languageOptions: {
        ecmaVersion: 2020,
        globals: globals.browser,
      },
    }
  )
  .concat(prettierRecommended)
  .concat({
    rules: {
      'no-console': ['error'],
      'prettier/prettier': [
        'error',
        {
          endOfLine: 'auto',
          singleQuote: true,
          trailingComma: 'es5',
          printWidth: 120,
          ignoreComments: true,
          jsxSingleQuote: false,
          jsxBracketSameLine: true,
        },
      ],
    },
  });
