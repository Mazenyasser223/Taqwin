require('dotenv').config();
const { fetchHtml } = require('../src/lib/webtebScraper');

const url = 'https://www.webteb.com/nutritionfacts/dairy-and-egg/البيض_01123';

(async () => {
  const html = await fetchHtml(url);
  const scripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const s of scripts) {
    if (/1017[2-7]|weightId|Weight|serving/i.test(s)) {
      const chunk = s.slice(0, 2000).replace(/\s+/g, ' ');
      if (chunk.length > 50) console.log(chunk.slice(0, 1500), '\n---\n');
    }
  }
  // common JSON blobs
  const jsonMatches = html.match(/\{[^{}]{0,200}1017[2-7][^{}]{0,200}\}/g);
  if (jsonMatches) jsonMatches.slice(0, 5).forEach((m) => console.log('JSON', m));
})();
