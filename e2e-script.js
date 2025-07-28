// e2e-script.js
import puppeteer from 'puppeteer';

const APP_URL      = process.env.APP_URL;
const APP_PASSWORD = process.env.APP_PASSWORD;
const WEBHOOK_URL  = 'https://hook.eu2.make.com/0ui64t2di3wvvg00fih0d32qp9i9jgme';

async function sendStatus(status, message = '', details = {}) {
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        level: status,
        message,
        category: 'GitHub Action E2E',
        details
      }),
    });
    console.log(`Status sent: ${status}`);
  } catch (e) {
    console.error('Webhook error:', e);
  }
}

(async () => {
  if (!APP_URL || !APP_PASSWORD) {
    console.error('Missing APP_URL or APP_PASSWORD');
    await sendStatus('ERROR', 'Missing env vars');
    process.exit(1);
  }

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    console.log(`Going to ${APP_URL}`);
    await page.goto(APP_URL, { waitUntil: 'networkidle0' });

    console.log('Entering password…');
    await page.waitForSelector('input[type="password"]', { timeout: 30000 });
    await page.type('input[type="password"]', APP_PASSWORD);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle0' })
    ]);

    const btnXPath = "//button[contains(., 'START AUTOMATION')]";
    console.log('Waiting for Start button…');
    await page.waitForXPath(btnXPath, { timeout: 30000 });
    const [btn] = await page.$x(btnXPath);
    if (!btn) throw new Error('Start button not found');
    await btn.click();

    console.log('Waiting for completion…');
    await page.waitForXPath(`${btnXPath}[not(@disabled)]`, { timeout: 900000 });

    const hasErrors = await page.evaluate(() => !!document.querySelector('.border-red-500'));
    if (hasErrors) {
      console.log('Process finished with errors');
      await sendStatus('ERROR', 'Batch had errors');
    } else {
      console.log('Process succeeded');
      await sendStatus('SUCCESS', 'Batch completed');
    }
  } catch (err) {
    console.error('Automation error:', err);
    await sendStatus('ERROR', err.message, { stack: err.stack });
    process.exit(1);
  } finally {
    console.log('Closing browser');
    await browser.close();
  }
})();
