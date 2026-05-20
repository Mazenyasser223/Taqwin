require('dotenv').config();
const { fetchHtml } = require('../src/lib/webtebScraper');

const url = 'https://www.webteb.com/nutritionfacts/dairy-and-egg/البيض_01123';

(async () => {
  const tests = [
    '?amount=1&weightId=10176',
    '?amount=100&weightId=',
    '?amount=1&weightId=10172',
  ];
  for (const q of tests) {
    const html = await fetchHtml(url + q);
    const energy = html.match(/طاقة[^<]{0,30}([\d.]+)\s*kcal/i);
    const protein = html.match(/بروتين[^<]{0,30}([\d.]+)\s*g/i);
    console.log(q, 'energy', energy?.[1], 'protein', protein?.[1]);
  }
})();
