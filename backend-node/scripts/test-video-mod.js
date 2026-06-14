require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { runVideoModeration } = require('../src/lib/moderationVideo');

async function main() {
  const prisma = new PrismaClient();
  const media = await prisma.communityPostMedia.findFirst({
    where: { mediaType: 'video' },
    orderBy: { createdAt: 'desc' },
  });
  if (!media) {
    console.log('No video posts found');
    await prisma.$disconnect();
    return;
  }
  console.log('Testing moderation on:', media.url.slice(0, 80));
  try {
    await runVideoModeration(media.url, 'ar');
    console.log('RESULT: passed (not blocked)');
  } catch (err) {
    console.log('RESULT: blocked —', err.category, err.source, err.messageFor?.('ar') || err.message);
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
