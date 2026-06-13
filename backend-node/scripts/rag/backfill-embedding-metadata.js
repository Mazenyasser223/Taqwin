/* eslint-disable no-console */
/**
 * Stamp embedding_model / embedding_version on chunks that already have vectors
 * (avoids full re-embed when only lifecycle metadata is missing).
 */
require('dotenv').config();
const { getPrisma } = require('../lib/pgvectorIngest');
const { providerInfo, embeddingIdentity } = require('../../src/services/embeddingsProvider');

async function main() {
  const { model } = providerInfo();
  const { version } = embeddingIdentity();
  const prisma = getPrisma();
  const modelSql = model ? `'${String(model).replace(/'/g, "''")}'` : 'NULL';
  const versionSql = version ? `'${String(version).replace(/'/g, "''")}'` : 'NULL';

  const result = await prisma.$executeRawUnsafe(`
    UPDATE knowledge_chunks
    SET embedding_model = ${modelSql},
        embedding_version = ${versionSql}
    WHERE embedding IS NOT NULL
      AND (embedding_model IS NULL OR embedding_version IS NULL)
  `);
  console.log(`Stamped embedding metadata on ${result} chunk(s) (model=${model}, version=${version})`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
