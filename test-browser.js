const puppeteer = require('puppeteer-core');

(async () => {
  try {
    const browser = await puppeteer.connect({ browserURL: 'http://localhost:8315' });
    const targets = await browser.targets();
    const pageTarget = targets.find(t => t.type() === 'page');
    if (!pageTarget) return;
    const page = await pageTarget.page();
    
    page.on('response', response => {
      if (!response.ok()) {
        console.log(`HTTP ${response.status()} ${response.url()}`);
      }
    });
    
    await page.reload();
    await new Promise(r => setTimeout(r, 2000));
    
    await browser.disconnect();
  } catch (err) {}
})();
