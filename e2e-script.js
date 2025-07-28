// e2e-script.js
import puppeteer from 'puppeteer';

const APP_URL      = process.env.APP_URL;
const APP_PASSWORD = process.env.APP_PASSWORD;
const WEBHOOK_URL  = 'https://hook.eu2.make.com/0ui64t2di3wvvg00fih0d32qp9i9jgme';

// Wait until an XPath selector matches something in the DOM
async function waitForXPath(page, xpath, timeout = 30000) {
  await page.waitForFunction(
    (xp) => {
      const result = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return !!result.singleNodeValue;
    },
    { timeout },
    xpath
  );
}

async function sendStatus(status, message = '', details = {}) {
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp: new Date().toISOString(), level: status, message, category: 'GitHub Action E2E', details }),
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
    await page.click('button[type="submit"]');

    // Wait for the START AUTOMATION button to appear
    const btnXPath = "//button[contains(., 'START AUTOMATION')]";
    console.log('Waiting for START AUTOMATION button to appear…');
    await waitForXPath(page, btnXPath, 60000);

    // Click the button
    const [btn] = await page.$x(btnXPath);
    if (!btn) throw new Error('START AUTOMATION button not found');
    await btn.click();
    console.log('Clicked START AUTOMATION — waiting for completion…');

    // Wait for the button to re-enable (i.e. no @disabled)
    const reenableXPath = `${btnXPath}[not(@disabled)]`;
    console.log('Waiting for process to finish (button re-enable)…');
    await waitForXPath(page, reenableXPath, 900000);

    // Check for errors in the page
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
