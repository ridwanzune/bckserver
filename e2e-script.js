// e2e-script.js
import puppeteer from 'puppeteer';

const APP_URL = process.env.APP_URL;
const APP_PASSWORD = process.env.APP_PASSWORD;
const WEBHOOK_URL = 'https://hook.eu2.make.com/0ui64t2di3wvvg00fih0d32qp9i9jgme';

async function sendStatus(level, message = '', details = {}) {
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        message,
        category: 'GitHub Action E2E',
        details
      }),
    });
    console.log(`Status sent: ${level}`);
  } catch (err) {
    console.error('Webhook send failed:', err);
  }
}

(async () => {
  if (!APP_URL || !APP_PASSWORD) {
    console.error('APP_URL or APP_PASSWORD missing');
    await sendStatus('ERROR', 'Missing required environment variables');
    process.exit(1);
  }

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  try {
    console.log(`Navigating to ${APP_URL} ...`);
    await page.goto(APP_URL, { waitUntil: 'networkidle0' });

    console.log('Entering password...');
    await page.waitForSelector('input[type="password"]', { timeout: 30000 });
    await page.type('input[type="password"]', APP_PASSWORD);
    await page.click('button[type="submit"]');

    const btnXPath = "//button[contains(., 'START AUTOMATION')]";
    console.log('Waiting for START AUTOMATION button...');
    await page.waitForSelector(`xpath/${btnXPath}`, { timeout: 60000 });

    const btn = await page.$(`xpath/${btnXPath}`);
    if (!btn) throw new Error('START AUTOMATION button not found');
    await btn.click();

    console.log('Waiting for completion (button to re-enable)...');
    await page.waitForSelector(`xpath/${btnXPath}[not(@disabled)]`, { timeout: 900000 });

    const hasErrors = await page.evaluate(() => !!document.querySelector('.border-red-500'));
    console.log(hasErrors ? 'Detected errors' : 'Completed successfully');

    await sendStatus(hasErrors ? 'ERROR' : 'SUCCESS', hasErrors ? 'Batch had errors' : 'Batch completed');
  } catch (err) {
    console.error('Automation error:', err);
    await sendStatus('ERROR', err.message, { stack: err.stack });
    process.exit(1);
  } finally {
    console.log('Closing browser');
    await browser.close();
  }
})();
