/**
 * Give each story a unique media URL when an author has multiple stories pointing at the same file.
 * Safe for picsum seeds and duplicate upload paths in demo data.
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function uniqueMediaUrl(story, index) {
  const url = story.mediaUrl || '';
  const picsum = url.match(/^(https:\/\/picsum\.photos\/seed\/)([^/]+)(\/\d+\/\d+)$/);
  if (picsum) {
    return `${picsum[1]}${picsum[2]}-${index + 1}${picsum[3]}`;
  }
  if (url.includes('?')) return `${url}&story=${story.id}`;
  return `${url}?story=${story.id}`;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const stories = await prisma.communityStory.findMany({
    where: { expiresAt: { gt: new Date() } },
    orderBy: [{ authorId: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, authorId: true, mediaUrl: true },
  });

  const byAuthor = new Map();
  for (const s of stories) {
    if (!byAuthor.has(s.authorId)) byAuthor.set(s.authorId, []);
    byAuthor.get(s.authorId).push(s);
  }

  let updated = 0;
  for (const list of byAuthor.values()) {
    if (list.length < 2) continue;
    const seen = new Map();
    for (let i = 0; i < list.length; i++) {
      const story = list[i];
      const count = seen.get(story.mediaUrl) ?? 0;
      seen.set(story.mediaUrl, count + 1);
      if (count === 0) continue;
      const nextUrl = uniqueMediaUrl(story, i);
      console.log(`fix ${story.id.slice(0, 8)} -> ${nextUrl}`);
      if (!dryRun) {
        await prisma.communityStory.update({
          where: { id: story.id },
          data: { mediaUrl: nextUrl },
        });
      }
      updated += 1;
    }
  }

  console.log(dryRun ? `Would update ${updated} stories` : `Updated ${updated} stories`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
