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

  // --- Enhancement: Set a realistic User-Agent to avoid being blocked ---
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');

  // --- Enhancement: Capture console logs for better debugging ---
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => {
    console.log(`PAGE ERROR: ${error.message}`);
  });

  try {
    // --- Step 1: Navigate to the main page and log in ---
    console.log(`Navigating to the main page: ${APP_URL}`);
    await page.goto(APP_URL, { waitUntil: 'networkidle0', timeout: 60000 });
    
    console.log('Waiting for password screen...');
    await page.waitForSelector('input#password', { timeout: 30000 });
    
    console.log('Entering password...');
    await page.type('input#password', APP_PASSWORD);
    
    console.log('Clicking unlock...');
    await page.click('button[type="submit"]');

    // --- Step 2: Start the automation process ---
    const startBtnXPath = "//button[contains(., 'START AUTOMATION')]";
    console.log('Waiting for main application screen...');
    await page.waitForSelector(`xpath/${startBtnXPath}`, { visible: true, timeout: 30000 });
    
    console.log('Clicking START AUTOMATION button...');
    await page.click(`xpath/${startBtnXPath}`);

    // --- Step 3: Wait for the automation to complete (Robust Two-Step Wait) ---
    // First, wait for the process to START (button becomes disabled and says 'PROCESSING')
    const disabledBtnXPath = "//button[contains(., 'PROCESSING')][@disabled]";
    console.log('Automation triggered. Waiting for processing to begin...');
    await page.waitForSelector(`xpath/${disabledBtnXPath}`, { timeout: 15000 }); // Wait up to 15s for processing to start

    // Second, wait for the process to FINISH (button becomes enabled again with text 'AUTOMATION')
    const enabledBtnXPath = "//button[contains(., 'AUTOMATION')][not(@disabled)]";
    console.log('Processing has begun. Waiting for completion (this may take up to 15 minutes)...');
    await page.waitForSelector(`xpath/${enabledBtnXPath}`, { timeout: 900000 }); // 15 minute timeout

    console.log('Automation process has completed.');
    
    console.log('Waiting an additional 5 seconds for UI to stabilize...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // --- Step 4: Check the result ---
    // The run is successful if at least one piece of content was generated.
    const hasSuccess = await page.evaluate(() => !!document.querySelector('[data-status="Done"]'));

    if (hasSuccess) {
      console.log('Batch completed with at least one successful task.');
      await sendStatus('SUCCESS', 'Batch completed successfully.');
    } else {
      console.log('Detected that no tasks completed successfully.');
      
      // --- Enhancement: Extract specific error messages from the UI ---
      const errorDetails = await page.evaluate(() => {
        const errors = [];
        const errorTasks = document.querySelectorAll('[data-status="Error"]');
        errorTasks.forEach(task => {
          const categoryName = task.querySelector('p.font-black')?.textContent || 'Unknown Category';
          const errorMessage = task.querySelector('p.font-bold.text-white')?.textContent || 'No specific error message found.';
          errors.push({ category: categoryName, error: errorMessage });
        });
        return errors;
      });

      await sendStatus('ERROR', 'Batch completed with no successful content.', { failedTasks: errorDetails });
    }

  } catch (err) {
    console.error('E2E script automation error:', err);
    await sendStatus('ERROR', `E2E script failed: ${err.message}`, { stack: err.stack });
    process.exit(1);
  } finally {
    console.log('Closing browser');
    await browser.close();
  }
})();