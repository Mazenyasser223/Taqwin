require('dotenv').config();
const cheerio = require('cheerio');
const { fetchHtml } = require('../src/lib/webtebScraper');
const { parseWebtebFoodPage } = require('../src/lib/webtebParsePage');

const url = process.argv[2] || 'https://www.webteb.com/nutritionfacts/dairy-and-egg/البيض_01123';

(async () => {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  console.log('--- headings ---');
  $('h2, h3, h4').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (/كمية|الوزن|اختر|حساب|وحدة|الحجم/i.test(t)) console.log('H:', t);
  });
  console.log('--- select options ---');
  $('select option').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t) console.log('OPT:', t, '| val:', $(el).attr('value'));
  });
  console.log('--- tables with كمية/وزن ---');
  $('table').each((_, tbl) => {
    const rows = [];
    $(tbl)
      .find('tr')
      .each((__, tr) => {
        const cells = $(tr)
          .find('td, th')
          .map((___, c) => $(c).text().replace(/\s+/g, ' ').trim())
          .get();
        if (cells.length) rows.push(cells.join(' | '));
      });
    const blob = rows.join('\n');
    if (/كمية|وزن|الحجم|الوزن/i.test(blob)) {
      console.log('TABLE:');
      rows.slice(0, 12).forEach((r) => console.log(' ', r));
    }
  });
  const parsed = parseWebtebFoodPage($, url);
  console.log('--- parsed servingUnits ---', parsed.servingUnits.length);
  console.log(JSON.stringify(parsed.servingUnits, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
