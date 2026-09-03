import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['shared/**/*.test.ts', 'n8n/**/*.test.js', 'n8n/**/*.test.ts', 'scripts/**/*.test.ts'],
    passWithNoTests: true,
  },
});
