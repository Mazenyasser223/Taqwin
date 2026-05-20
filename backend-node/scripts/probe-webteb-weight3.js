require('dotenv').config();
const cheerio = require('cheerio');
const { fetchHtml } = require('../src/lib/webtebScraper');
const { parseWebtebFoodPage } = require('../src/lib/webtebParsePage');

const base = 'https://www.webteb.com/nutritionfacts/dairy-and-egg/البيض_01123';

async function macrosFor(query) {
  const html = await fetchHtml(base + query);
  const $ = cheerio.load(html);
  const p = parseWebtebFoodPage($, base);
  return { calories: p.calories, protein: p.protein, amount: $('input[name=amount]').attr('value') };
}

(async () => {
  const a = await macrosFor('');
  const b = await macrosFor('?amount=1&weightId=10176');
  const c = await macrosFor('?amount=1&weightId=10177');
  const d = await macrosFor('?amount=1&weightId=10172');
  const e = await macrosFor('?amount=100&weightId=');
  console.log('default', a);
  console.log('medium egg x1', b);
  console.log('small egg x1', c);
  console.log('cup x1', d);
  console.log('100g', e);
})();
