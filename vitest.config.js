import { defineConfig } from 'vitest/config';

// One test run covers the server (tests/) and the browser helpers (frontend/src/lib).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js', 'frontend/src/**/*.test.js']
  }
});
