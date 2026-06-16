/**
 * Shared plan-generation prompt contract (single source: shared/plan-prompt-contract.json).
 */
const fs = require('fs');
const path = require('path');

const CONTRACT_PATH = path.join(__dirname, '..', '..', '..', '..', 'shared', 'plan-prompt-contract.json');

let cached = null;

function loadPlanPromptContract() {
  if (cached) return cached;
  const raw = fs.readFileSync(CONTRACT_PATH, 'utf8');
  cached = JSON.parse(raw);
  return cached;
}

function contractPath() {
  return CONTRACT_PATH;
}

module.exports = {
  loadPlanPromptContract,
  contractPath,
};
