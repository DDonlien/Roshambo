const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  await page.goto('http://localhost:5176/');
  await page.waitForTimeout(2000);
  const body = await page.content();
  console.log("Body length:", body.length);
  await browser.close();
})();
