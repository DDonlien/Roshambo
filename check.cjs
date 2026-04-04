const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  await page.goto('http://localhost:5176/');
  await page.waitForSelector('.sidebar-title', { timeout: 5000 }).catch(() => console.log('Sidebar not found!'));
  
  const content = await page.content();
  console.log('DOM length:', content.length);
  if (content.includes('Roshambo!')) {
    console.log('App successfully rendered!');
  } else {
    console.log('App failed to render.');
  }
  
  await browser.close();
})();
