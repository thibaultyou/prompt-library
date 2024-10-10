import typescriptEslint from '@typescript-eslint/eslint-plugin';
import _import from 'eslint-plugin-import';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import { fixupPluginRules } from '@eslint/compat';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [
    {
        ignores: ['**/.eslintrc.js', 'node_modules/*', 'dist/*']
    },
    ...compat.extends('eslint:recommended', 'plugin:@typescript-eslint/recommended').map((config) => ({
        ...config,
        files: ['**/*.ts']
    })),
    {
        files: ['**/*.ts'],
        plugins: {
            '@typescript-eslint': typescriptEslint,
            import: fixupPluginRules(_import),
            'simple-import-sort': simpleImportSort,
            'unused-imports': unusedImports
        },
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.jest
            },
            parser: tsParser,
            ecmaVersion: 2022,
            sourceType: 'module'
        },
        rules: {
            '@typescript-eslint/interface-name-prefix': 'off',
            '@typescript-eslint/explicit-function-return-type': 'error',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            'unused-imports/no-unused-imports': 'warn',
            'unused-imports/no-unused-vars': [
                'warn',
                {
                    vars: 'all',
                    varsIgnorePattern: '^_',
                    args: 'after-used',
                    argsIgnorePattern: '^_'
                }
            ],
            'simple-import-sort/imports': 'off',
            'simple-import-sort/exports': 'error',
            'import/order': [
                'error',
                {
                    groups: [['builtin'], ['external'], ['internal'], ['parent', 'sibling', 'index']],
                    pathGroups: [
                        {
                            pattern: '@config',
                            group: 'internal'
                        },
                        {
                            pattern: '@core/**',
                            group: 'internal'
                        },
                        {
                            pattern: '@types',
                            group: 'internal'
                        },
                        {
                            pattern: '@utils/**',
                            group: 'internal'
                        }
                    ],
                    pathGroupsExcludedImportTypes: ['builtin'],
                    alphabetize: {
                        order: 'asc',
                        caseInsensitive: true
                    },
                    'newlines-between': 'always'
                }
            ],
            'padding-line-between-statements': [
                'warn',
                {
                    blankLine: 'never',
                    prev: '*',
                    next: 'throw'
                },
                {
                    blankLine: 'never',
                    prev: ['const', 'let', 'var'],
                    next: '*'
                },
                {
                    blankLine: 'never',
                    prev: ['const', 'let', 'var'],
                    next: ['const', 'let', 'var']
                },
                {
                    blankLine: 'always',
                    prev: '*',
                    next: ['if', 'try', 'for', 'class', 'function', 'export']
                },
                {
                    blankLine: 'always',
                    prev: ['if', 'try', 'class', 'function', 'export'],
                    next: '*'
                },
                {
                    blankLine: 'never',
                    prev: '*',
                    next: 'return'
                }
            ],
            'arrow-body-style': ['error', 'as-needed'],
            'prefer-arrow-callback': [
                'error',
                {
                    allowNamedFunctions: true
                }
            ],
            'func-style': ['error', 'declaration'],
            'no-multi-spaces': 'error',
            'no-multiple-empty-lines': [
                'error',
                {
                    max: 1,
                    maxEOF: 0,
                    maxBOF: 0
                }
            ]
        }
    }
];
