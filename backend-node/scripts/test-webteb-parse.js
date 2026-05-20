require('dotenv').config();
const cheerio = require('cheerio');
const { fetchFoodPage } = require('../src/lib/webtebScraper');

const url =
  'https://www.webteb.com/nutritionfacts/vegetables/%D8%A8%D8%B5%D9%84-%D9%86%D9%8A%D8%A1_11282';

fetchFoodPage(url)
  .then((p) => console.log(JSON.stringify(p, null, 2)))
  .catch((e) => console.error(e));
