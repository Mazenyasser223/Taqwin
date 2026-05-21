#!/usr/bin/env node
require('dotenv').config();
const cheerio = require('cheerio');
const { fetchHtml } = require('../src/lib/webtebScraper');

async function probe(url) {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  console.log('URL:', url);
  console.log('title:', $('title').text().trim());
  console.log('h1:', $('h1').first().text().trim().slice(0, 120));
  $('link[rel="alternate"], link[hreflang]').each((_, el) => {
    const hreflang = $(el).attr('hreflang');
    const href = $(el).attr('href');
    if (hreflang || href) console.log('link:', hreflang, href);
  });
  const scripts = html.match(/"nameEn"\s*:\s*"([^"]+)"/);
  if (scripts) console.log('json nameEn:', scripts[1]);
  const ld = $('script[type="application/ld+json"]').first().text();
  if (ld) console.log('ld+json:', ld.slice(0, 300));
  console.log('---');
}

(async () => {
  await probe('https://www.webteb.com/nutritionfacts/dairy-and-egg/البيض_01123');
  await probe('https://www.webteb.com/en/nutritionfacts/dairy-and-egg/eggs_01123');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
