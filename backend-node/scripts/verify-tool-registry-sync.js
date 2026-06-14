/* eslint-disable no-console */
/**
 * Ensure FastAPI coach tool schemas ⊆ Node executable handlers.
 *
 *   npm run verify:tool-registry
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const aiServiceRoot = path.join(root, '..', 'ai-service');

const { listChatTools } = require('../src/services/aiToolExecutor');

function loadFastApiChatTools() {
  const py = spawnSync('python', ['scripts/list_chat_tools.py'], {
    cwd: aiServiceRoot,
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: aiServiceRoot },
  });
  if (py.status !== 0) {
    console.error(py.stderr || py.stdout || 'python failed');
    process.exit(1);
  }
  return (py.stdout || '')
    .trim()
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function main() {
  const nodeTools = new Set(listChatTools());
  const fastApiTools = loadFastApiChatTools();

  const missingOnNode = fastApiTools.filter((name) => !nodeTools.has(name));
  const extraOnNode = [...nodeTools].filter((name) => !fastApiTools.includes(name));

  console.log(`Node chat tools: ${nodeTools.size}`);
  console.log(`FastAPI chat tools: ${fastApiTools.length}`);

  if (missingOnNode.length) {
    console.error('\n✗ FastAPI advertises tools Node cannot execute:');
    for (const name of missingOnNode) console.error(`  - ${name}`);
    process.exit(1);
  }

  if (extraOnNode.length) {
    console.log('\n⚠ Node implements tools not in FastAPI chat registry (OK if internal):');
    for (const name of extraOnNode.slice(0, 10)) console.log(`  - ${name}`);
    if (extraOnNode.length > 10) console.log(`  ... +${extraOnNode.length - 10} more`);
  }

  console.log('\n✓ Tool registry sync OK — FastAPI chat tools ⊆ Node handlers');
  process.exit(0);
}

main();
