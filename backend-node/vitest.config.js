const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.js'],
    setupFiles: ['./tests/setup.cjs'],
    testTimeout: 15000,
    hookTimeout: 30000,
    pool: 'forks',
  },
});
