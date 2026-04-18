const globals = require('globals');

module.exports = [
  {
    files: ['main.js', 'preload.js', 'src/main/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-empty': 'off',
      'prefer-const': 'warn',
      'no-var': 'error'
    }
  },
  {
    files: ['src/renderer.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        confirm: 'readonly',
        Date: 'readonly',
        Math: 'readonly',
        parseInt: 'readonly',
        parseFloat: 'readonly',
        JSON: 'readonly',
        Error: 'readonly',
        Promise: 'readonly',
        console: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-empty': 'off',
      'prefer-const': 'warn',
      'no-var': 'error'
    }
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'test.js']
  }
];
