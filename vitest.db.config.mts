import { defineConfig } from 'vitest/config';

// Databastester (RLS) mot lokal PostgreSQL. Körs med `npm run test:db`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/db/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
