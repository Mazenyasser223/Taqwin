require('dotenv').config();
const { fetchHtml } = require('../src/lib/webtebScraper');

const FOOD_RE = /\/nutritionfacts\/[^/]+\/.+_\d+$/i;

async function main() {
  const xml = await fetchHtml('https://www.webteb.com/sitemaps/webteb/nutrition-facts-1.xml');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((m) => m[1]);
  const foods = locs.filter((u) => FOOD_RE.test(u));
  console.log('nutrition-facts-1.xml food urls:', foods.length);
  if (foods[0]) console.log('sample', foods[0]);
}

main().catch(console.error);
