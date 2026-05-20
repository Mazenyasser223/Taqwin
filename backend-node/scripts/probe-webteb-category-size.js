require('dotenv').config();
const cheerio = require('cheerio');
const { fetchHtml } = require('../src/lib/webtebScraper');
const { extractFoodLinks } = require('../src/lib/webtebScraper');

const slug = process.argv[2] || 'vegetables';
fetchHtml(`https://www.webteb.com/nutritionfacts/${slug}`)
  .then((html) => {
    const links = extractFoodLinks(html, slug);
    const $ = cheerio.load(html);
    console.log('slug', slug, 'links', links.length);
    console.log('pagination hints', $('a[href*="page"]').length, $('.pagination').length);
    $('a[href*="nutritionfacts"]').slice(0, 5).each((i, el) => console.log($(el).attr('href')));
  })
  .catch(console.error);
