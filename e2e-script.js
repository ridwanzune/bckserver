import puppeteer from 'puppeteer';

async function runAutomation() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    console.log('Navigating to ***...');
    await page.goto(process.env.TARGET_URL, { waitUntil: 'networkidle2' });

    console.log('Page loaded. Entering password...');
    await page.type('input[type="password"]', process.env.PASSWORD);
    await page.keyboard.press('Enter');

    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    console.log('Performing post-login actions...');
    // Example: clicking a button by ID (customize as needed)
    await page.click('#submitButton');

    console.log('Automation steps completed.');
    await sendStatusUpdate('SUCCESS');
  } catch (err) {
    console.error('An error occurred during the automation script:', err);
    await sendStatusUpdate('ERROR');
  } finally {
    console.log('Closing browser.');
    await browser.close();
  }
}

async function sendStatusUpdate(status) {
  const response = await fetch(process.env.STATUS_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, timestamp: new Date().toISOString() }),
  });
  console.log(`Successfully sent status update: ${status}`);
}

runAutomation();
