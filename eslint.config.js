export default [
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        URLSearchParams: 'readonly',
        localStorage: 'readonly',
        Image: 'readonly',
        Worker: 'readonly',
        Math: 'readonly',
        Date: 'readonly',
        Promise: 'readonly',
        Map: 'readonly',
        Set: 'readonly',
        Array: 'readonly',
        Uint8Array: 'readonly',
        Uint8ClampedArray: 'readonly',
        JSON: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-constant-condition': 'warn',
      'no-empty': 'warn'
    }
  }
]
