/**
 * Runs before smoke tests. Injects a Prisma mock so `require('./db')` never
 * opens a real connection (reliable on CI where DATABASE_URL is unset).
 */
const path = require('path');
const Module = require('module');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-vitest-pipeline-only';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://ci:ci@127.0.0.1:5432/taqwin_ci?schema=public';

const dbPath = path.resolve(__dirname, '../src/db.js');
const mock = require('./mocks/db.cjs');

require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: mock,
  children: [],
  paths: Module._nodeModulePaths(path.dirname(dbPath)),
};
