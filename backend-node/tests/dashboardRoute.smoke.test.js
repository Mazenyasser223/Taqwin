import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const requireFromHere = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const dashboardSrc = readFileSync(join(here, '../src/routes/dashboard.js'), 'utf8');

describe('dashboard route regressions', () => {
  it('imports getOrCreateUserSettings (home dashboard locale)', () => {
    expect(dashboardSrc).toContain('getOrCreateUserSettings');
    expect(dashboardSrc).toContain("require('../lib/userSettings')");
  });

  it('uses food log snapshots for today nutrition totals', () => {
    expect(dashboardSrc).toContain('scaledMacrosFromLog');
    expect(dashboardSrc).toContain("require('../lib/foodLogSnapshot')");
  });

  it('loads dashboard router without ReferenceError', () => {
    const express = requireFromHere('express');
    const app = express();
    const router = requireFromHere('../src/routes/dashboard');
    app.use('/api/dashboard', router);
    expect(app).toBeTruthy();
  });
});
