import puppeteer from 'puppeteer';

const APP_URL = process.env.APP_URL;
const APP_PASSWORD = process.env.APP_PASSWORD;
const WEBHOOK_URL = 'https://hook.eu2.make.com/...';

async function sendStatus(status, message = '') {
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp: new Date().toISOString(), level: status, message }),
    });
    console.log(`Status sent: ${status}`);
  } catch (e) {
    console.error('Webhook error:', e);
  }
}

(async () => {
  if (!APP_URL || !APP_PASSWORD) {
    console.error('Missing env vars');
    await sendStatus('ERROR', 'Env vars missing');
    process.exit(1);
  }

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto(APP_URL, { waitUntil: 'networkidle0' });
  console.log('Logging in...');

  await page.waitForSelector('input[type="password"]', { timeout: 30000 });
  await page.type('input[type="password"]', APP_PASSWORD);
  await page.click('button[type="submit"]');

  const btnXPath = "//button[contains(., 'START AUTOMATION')]";
  console.log('Waiting for START AUTOMATION button...');
  await page.waitForSelector(`xpath/${btnXPath}`, { timeout: 60000 });

  const startBtn = await page.$(`xpath/${btnXPath}`);
  if (!startBtn) throw new Error('Button not found');
  await startBtn.click();

  console.log('Waiting for completion...');
  const doneXPath = `${btnXPath}[not(@disabled)]`;
  await page.waitForSelector(`xpath/${doneXPath}`, { timeout: 900000 });

  const hasErrors = await page.evaluate(() => !!document.querySelector('.border-red-500'));
  await sendStatus(hasErrors ? 'ERROR' : 'SUCCESS', hasErrors ? 'Batch had errors' : 'Batch done');
  await browser.close();
})();
