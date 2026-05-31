import { defineConfig } from 'vitest/config';

// Pure-logic tests only (i18n core, formatters). React Native component tests
// run under jest-expo once UI components land — kept separate so this config
// stays Node-fast and never pulls in native modules.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
