/**
 * Smoke test — Muscle Wiki exercise APIs + static assets.
 * Usage: node scripts/test-muscle-wiki-api.js
 */
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();
const BASE = `http://127.0.0.1:${process.env.PORT || 4002}`;

async function api(path, token) {
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { ok: res.ok, status: res.status, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const health = await api('/health');
  assert(health.ok, `health failed: ${health.status}`);

  const user = await prisma.user.findFirst({
    where: { role: 'athlete', passwordHash: { not: null } },
    select: { id: true, email: true, role: true },
  });
  assert(user, 'no athlete user for API test');
  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const counts = await api('/api/exercises/muscle-counts', token);
  assert(counts.ok, `muscle-counts failed: ${counts.status} ${JSON.stringify(counts.json)}`);
  assert(typeof counts.json === 'object' && counts.json.back != null, 'expected back count');
  console.log('✓ GET /api/exercises/muscle-counts', 'back:', counts.json.back);

  const backList = await api('/api/exercises?muscle=back&pageSize=12&locale=en', token);
  assert(backList.ok, `exercises back failed: ${backList.status} ${JSON.stringify(backList.json)}`);
  assert(backList.json?.items?.length >= 1, 'expected back exercises');
  console.log('✓ GET /api/exercises?muscle=back', backList.json.items.length, 'items');

  const fbxPath = path.join(__dirname, '../../frontend/public/Jumping Down.fbx');
  const glbPath = path.join(__dirname, '../../frontend/public/captain_hema_fixed_final2.glb');
  assert(fs.existsSync(fbxPath), `missing ${fbxPath}`);
  console.log('✓ FBX asset exists', path.basename(fbxPath));

  const fbxHead = await fetch(`${BASE.replace('4002', '3000')}/Jumping%20Down.fbx`, { method: 'HEAD' }).catch(
    () => null
  );
  if (fbxHead?.ok) {
    console.log('✓ FBX served from frontend :3000');
  } else {
    console.log('· FBX on :3000 not checked (use dev server)');
  }

  if (fs.existsSync(glbPath)) {
    console.log('✓ GLB asset exists', path.basename(glbPath));
  } else {
    console.log('· GLB missing (CaptainHema fallback picker will show)');
  }

  console.log('\n✓ Muscle Wiki API smoke test passed');
}

main()
  .catch((e) => {
    console.error('\n✗', e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
