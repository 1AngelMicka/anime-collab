// eslint.config.mjs
import next from 'eslint-config-next'

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  // Preset officiel Next.js (React, TS, a11y, web-vitals)
  ...next(),

  // Ton réglage perso (ajuste à ton goût)
  {
    rules: {
      // --- bruits courants ---
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-alert': 'off',

      // TypeScript
      '@typescript-eslint/no-explicit-any': 'off', // passe en 'warn' si tu veux
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
      ],

      // React/JSX
      'react/jsx-key': 'warn',

      // Next.js core web vitals (évite les faux positifs en dev)
      '@next/next/no-img-element': 'off', // on utilise <img> simple ici
    },
  },
]
