/* eslint-disable no-console */
/**
 * Verify shared plan prompt contract is present and matches FastAPI plan_prompts.py.
 *
 *   npm run verify:plan-prompt-contract
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadPlanPromptContract, contractPath } = require('../src/lib/plans/planPromptContract');

function fail(msg) {
  console.error(`✗ ${msg}`);
  return false;
}

function ok(msg) {
  console.log(`✓ ${msg}`);
  return true;
}

function main() {
  console.log('Plan prompt contract sync\n');
  let passed = true;

  const contractFile = contractPath();
  if (!fs.existsSync(contractFile)) {
    process.exit(fail(`Missing contract: ${contractFile}`) ? 1 : 1);
  }
  ok(`contract file: ${contractFile}`);

  const contract = loadPlanPromptContract();
  const required = [
    'version',
    'systemPromptIntro',
    'hardRules',
    'schemaHint',
    'localeDirectives',
    'userPromptClosing',
  ];
  for (const key of required) {
    if (contract[key] == null || contract[key] === '') {
      passed = fail(`Missing or empty contract field: ${key}`) && passed;
    }
  }
  if (!Array.isArray(contract.hardRules) || contract.hardRules.length < 5) {
    passed = fail('hardRules must be a non-empty array') && passed;
  } else {
    ok(`hardRules: ${contract.hardRules.length} rules`);
  }

  const aiServiceRoot = path.join(__dirname, '..', '..', 'ai-service');
  const probe = spawnSync(
    process.platform === 'win32' ? 'python' : 'python3',
    [
      '-c',
      [
        'import json, sys',
        'from pathlib import Path',
        'from app.prompts.plan_prompts import hard_rules, schema_hint, contract_path, _load_contract',
        'c = _load_contract()',
        'assert hard_rules() == c["hardRules"], "hard_rules drift"',
        'assert schema_hint() == c["schemaHint"], "schema_hint drift"',
        'assert contract_path().exists(), "contract path missing"',
        'print(json.dumps({"rules": len(hard_rules()), "contract": str(contract_path())}))',
      ].join('; '),
    ],
    { cwd: aiServiceRoot, encoding: 'utf8', env: process.env },
  );

  if (probe.status !== 0) {
    if (probe.stdout) process.stdout.write(probe.stdout);
    if (probe.stderr) process.stderr.write(probe.stderr);
    passed = fail('FastAPI plan_prompts.py does not match shared contract') && passed;
  } else {
    try {
      const out = JSON.parse((probe.stdout || '').trim());
      ok(`Python loads contract (${out.rules} rules) — ${out.contract}`);
    } catch {
      ok('Python plan_prompts contract probe passed');
    }
  }

  console.log('');
  if (!passed) process.exit(1);
  console.log('✓ Plan prompt contract OK');
  process.exit(0);
}

main();
