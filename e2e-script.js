import puppeteer from 'puppeteer-core';
import { execSync } from 'child_process';

async function runAutomation() {
  const chromiumPath = execSync('which chromium-browser || which chromium').toString().trim();

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: chromiumPath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    console.log('Navigating to target...');
    await page.goto(process.env.TARGET_URL, { waitUntil: 'networkidle2' });

    console.log('Entering password...');
    await page.type('input[type="password"]', process.env.PASSWORD);
    await page.keyboard.press('Enter');

    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    console.log('Clicking post-login button...');
    await page.click('#submitButton');

    console.log('Automation steps completed.');
    await sendStatusUpdate('SUCCESS');
  } catch (err) {
    console.error('Error during automation:', err);
    await sendStatusUpdate('ERROR');
  } finally {
    await browser.close();
  }
}

async function sendStatusUpdate(status) {
  const response = await fetch(process.env.STATUS_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, timestamp: new Date().toISOString() }),
  });
  console.log(`Status update sent: ${status}`);
}

runAutomation();
