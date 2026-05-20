require('dotenv').config();
const cheerio = require('cheerio');
const { fetchHtml } = require('../src/lib/webtebScraper');
const { parseWebtebFoodPage } = require('../src/lib/webtebParsePage');

const url =
  'https://www.webteb.com/nutritionfacts/vegetables/%D8%A8%D8%B5%D9%84-%D9%86%D9%8A%D8%A1_11282';

fetchHtml(url).then((h) => {
  const $ = cheerio.load(h);
  $('h2.s-title').each((i, head) => {
    const $h = $(head);
    const table = $h.parent().next().find('table').first();
    console.log($h.text().trim().slice(0, 40), 'rows', table.find('tr').length);
  });
  console.log('--- parsed ---');
  console.log(JSON.stringify(parseWebtebFoodPage($, url), null, 2));
});
