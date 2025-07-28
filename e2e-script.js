// e2e-script.js
import puppeteer from 'puppeteer';

const runAutomation = async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  try {
    console.log('Navigating to your app...');
    await page.goto('https://your-app-url.vercel.app/', { waitUntil: 'networkidle0' });

    console.log('Page loaded. Entering password...');
    await page.type('input[type="password"]', process.env.APP_PASSWORD);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
    ]);

    console.log('Waiting for "Generate" button...');
    const [generateBtn] = await page.$x("//button[contains(., 'Generate')]");
    if (!generateBtn) throw new Error('"Generate" button not found');
    await generateBtn.click();

    console.log('Waiting for completion...');
    await page.waitForTimeout(10000); // adjust based on actual app speed

    console.log('Automation complete.');
    await sendStatus('SUCCESS');
  } catch (err) {
    console.error('An error occurred during the automation script:', err);
    await sendStatus('ERROR');
  } finally {
    console.log('Closing browser.');
    await browser.close();
  }
};

const sendStatus = async (status) => {
  const webhookUrl = process.env.STATUS_WEBHOOK;
  if (!webhookUrl) {
    console.warn('No STATUS_WEBHOOK provided. Skipping status send.');
    return;
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });

  console.log(`Successfully sent status update: ${status}`);
};

runAutomation();
