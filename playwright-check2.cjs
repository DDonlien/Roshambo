const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('requestfailed', request => console.log('FAILED:', request.url(), request.failure().errorText));
  page.on('response', response => {
    if (response.status() >= 400) console.log('BAD RESPONSE:', response.url(), response.status());
  });
  await page.goto('http://localhost:5174/');
  await page.waitForTimeout(2000);
  await browser.close();
})();
