import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    setupFiles: ['tests/setup.ts'],
    // All test files share one database (the Neon branch `test`), so they run one at a time.
    fileParallelism: false,
    // Every request goes to Neon, so allow more than the default 5 s.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
