import puppeteer from 'puppeteer';

const APP_URL = process.env.APP_URL;
const APP_PASSWORD = process.env.APP_PASSWORD;
const WEBHOOK_URL = 'https://hook.eu2.make.com/0ui64t2di3wvvg00fih0d32qp9i9jgme';

async function sendStatusUpdate(status, message, details = {}) {
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        level: status, // 'SUCCESS' or 'ERROR'
        message,
        category: 'GitHub Action E2E',
        details,
      }),
    });
    console.log(`Successfully sent status update: ${status}`);
  } catch (error) {
    console.error('Failed to send status update to webhook:', error);
  }
}

async function runAutomation() {
  if (!APP_URL || !APP_PASSWORD) {
    console.error('APP_URL and APP_PASSWORD environment variables must be set.');
    await sendStatusUpdate('ERROR', 'Missing APP_URL or APP_PASSWORD environment variables.');
    throw new Error('APP_URL and APP_PASSWORD environment variables must be set.');
  }

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(120000); // 2 minutes

  try {
    console.log(`Navigating to ${APP_URL}...`);
    await page.goto(APP_URL, { waitUntil: 'networkidle0' });
    console.log('Page loaded. Entering password...');

    await page.waitForSelector('input[type="password"]', { timeout: 30000 });
    await page.type('input[type="password"]', APP_PASSWORD);
    await page.click('button[type="submit"]');
    console.log('Password submitted.');

    const startButtonXPath = '//button[contains(., "START AUTOMATION")]';
    await page.waitForXPath(startButtonXPath, { timeout: 30000 });
    const [startButton] = await page.$x(startButtonXPath);
    if (!startButton) throw new Error('START AUTOMATION button not found');
    await startButton.click();
    console.log('Automation started. Waiting for completion...');

    // Wait for start button to be enabled again, indicating process complete
    await page.waitForXPath(`${startButtonXPath}[not(@disabled)]`, { timeout: 900000 });
    console.log('Automation process finished.');

    const hasErrors = await page.evaluate(() => !!document.querySelector('.border-red-500'));

    if (hasErrors) {
      console.log('Errors detected in batch process.');
      await sendStatusUpdate('ERROR', 'Automation completed with failed tasks.');
    } else {
      console.log('All tasks completed successfully.');
      await sendStatusUpdate('SUCCESS', 'Automation batch process completed successfully.');
    }
  } catch (error) {
    console.error('Automation script error:', error);
    await sendStatusUpdate('ERROR', 'Automation script failed.', { error: error.message });
    throw error;
  } finally {
    console.log('Closing browser.');
    await browser.close();
  }
}

runAutomation().catch(() => process.exit(1));
