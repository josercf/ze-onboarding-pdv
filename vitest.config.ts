import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['shared/**/*.test.ts', 'n8n/**/*.test.js', 'scripts/**/*.test.ts'],
    passWithNoTests: true,
  },
});
