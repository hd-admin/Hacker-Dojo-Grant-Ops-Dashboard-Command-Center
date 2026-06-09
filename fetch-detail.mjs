import { chromium } from 'playwright';
const id = process.argv[2];
if (!id) { console.error('usage: fetch-detail.mjs <id>'); process.exit(1); }
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
const url = `https://www.grants.gov/opportunities/${id}`;

// Watch for the API call
const apiCalls = [];
page.on('request', req => {
  if (req.url().includes('grantsws') || req.url().includes('api/')) {
    apiCalls.push({ url: req.url(), method: req.method() });
  }
});
page.on('response', async resp => {
  const url = resp.url();
  if (url.includes('opportunityDetails') || url.includes('grantsws') && resp.status() === 200) {
    try {
      const text = await resp.text();
      console.log('RESP', url, '=>', text.substring(0, 2000));
    } catch {}
  }
});

try {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(5000);
  console.log('Final URL:', page.url());
  console.log('Title:', await page.title());
  console.log('H1:', await page.locator('h1').first().textContent().catch(() => 'none'));
  console.log('Body sample:', (await page.locator('body').textContent()).slice(0, 2000));
} catch (e) {
  console.error('error:', e.message);
} finally {
  console.log('--- API calls ---');
  for (const c of apiCalls.slice(0, 30)) console.log(c.method, c.url);
  await browser.close();
}
