import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        extends: [...tseslint.configs.recommended],
        files: ['src/**/*.ts'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'error',

            '@typescript-eslint/no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
            }],

            '@typescript-eslint/consistent-type-imports': ['error', {
                prefer: 'type-imports',
                fixStyle: 'inline-type-imports',
            }],

            '@typescript-eslint/no-non-null-assertion': 'warn',

            'no-empty': ['error', { allowEmptyCatch: true }],
        },
    },

    {
        files: ['test/**/*.js'],
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
        },
    },

    {
        ignores: ['dist/**', 'coverage/**', 'scripts/**', 'examples/**'],
    },
);